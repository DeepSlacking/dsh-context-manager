/**
 * billion-context (bili) detection and statistics adapter.
 *
 * bili compresses *outbound* model requests inside its own proxy instead of
 * committing DSH session checkpoints, so it publishes its own per-session
 * statistics over a loopback HTTP API. This module locates a live proxy
 * (environment or instance registry) and normalizes the handful of endpoints
 * this plugin's UI needs. Every network call is best-effort: an unavailable
 * proxy yields `available: false` with a readable reason instead of throwing.
 *
 * The module only depends on Node builtins so it can be unit-tested without
 * the Harness runtime.
 * @module dsh-context-manager/bili
 */
import { readdirSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

/** Service name provided by billion-context's always-on DSH gate entry. */
export const BILI_SERVICE_NAME = 'biliBasicCompactionPolicy'
/** Environment variable bili uses to mark a DSH host as owned by its plugin. */
export const BILI_HOST_ENV = 'BILLION_CONTEXT_NATIVE'
/** Environment variable bili uses for an explicit proxy origin. */
export const BILI_PROXY_ENV = 'BILLION_CONTEXT_PROXY'
/** Global flag bili's native plugin sets once it has claimed DSH compaction. */
export const BILI_VERDICT_KEY = '__BILI_DSH_COMPACTION_VERDICT__'

const DEFAULT_TIMEOUT_MS = 2500
const MANIFEST_TIMEOUT_MS = 1500
const MAX_CACHE_REPORT_CHARS = 12000

const asText = (value) => (typeof value === 'string' ? value : '')
const asNumber = (value) => (typeof value === 'number' && Number.isFinite(value) ? value : null)
const rounded = (value) => {
  const number = asNumber(value)
  return number === null ? null : Math.round(number)
}
const stripSlash = (value) => value.replace(/\/+$/, '')

/** True when a process id is alive (used to ignore stale registry entries). */
function isPidAlive(pid) {
  if (typeof pid !== 'number' || !Number.isFinite(pid) || pid <= 0) return false
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    return error !== null && typeof error === 'object' && error.code === 'EPERM'
  }
}

/**
 * Read the static signals that mean "the billion-context bundle is loaded".
 * @param {object} ctx - Cordis context of the host service.
 * @param {NodeJS.ProcessEnv} [env] - environment to inspect.
 * @param {object} [globals] - global object to inspect.
 * @returns {{service:boolean,env:boolean,verdict:boolean,detected:boolean}} bili signals.
 */
export function detectBiliSignals(ctx, env = process.env, globals = globalThis) {
  let service = false
  try {
    service = ctx?.get?.(BILI_SERVICE_NAME) !== undefined
  } catch {
    service = false
  }
  const envSignal = asText(env?.[BILI_HOST_ENV]).trim().length > 0
  const verdict = globals?.[BILI_VERDICT_KEY] === 'active'
  return { service, env: envSignal, verdict, detected: service || envSignal || verdict }
}

/** Directories that may hold bili instance registry files. */
function registryDirs(env, home) {
  const xdg = asText(env?.XDG_STATE_HOME).trim()
  const stateDirs = []
  if (xdg.length > 0) stateDirs.push(join(xdg, 'billion-context'))
  stateDirs.push(join(home, '.local', 'state', 'billion-context'))
  stateDirs.push(join(home, '.local', 'share', 'billion-context'))
  return stateDirs.map((dir) => join(dir, 'instances'))
}

/** Normalize one registry file into `{origin,pid,startedAt}` or null. */
function readInstanceFile(file) {
  try {
    const raw = JSON.parse(readFileSync(file, 'utf8'))
    if (raw === null || typeof raw !== 'object') return null
    const origin = stripSlash(asText(raw.origin))
    const port = rounded(raw.port) ?? 0
    const pid = rounded(raw.pid) ?? 0
    const resolved = origin.length > 0 && /^https?:\/\//.test(origin) ? origin : port > 0 ? `http://127.0.0.1:${port}` : null
    if (resolved === null) return null
    return {
      origin: resolved,
      pid,
      startedAt: rounded(raw.startedAt) ?? 0,
      lane: asText(raw.lane) || null,
    }
  } catch {
    return null
  }
}

/**
 * Locate a live billion-context proxy origin.
 *
 * Prefers an explicit `BILLION_CONTEXT_PROXY` environment value, then the
 * newest live instance registered under the state directory. Stale registry
 * entries (dead pid) are ignored.
 * @param {NodeJS.ProcessEnv} [env] - environment to inspect.
 * @param {string} [home] - user home directory.
 * @returns {{origin:string|null,source:'env'|'registry'|'none',instance:object|null}} discovery result.
 */
export function discoverOrigin(env = process.env, home = homedir()) {
  const explicit = stripSlash(asText(env?.[BILI_PROXY_ENV]).trim())
  if (explicit.length > 0 && /^https?:\/\//.test(explicit)) return { origin: explicit, source: 'env', instance: null }
  let best = null
  for (const dir of registryDirs(env, home)) {
    let names = []
    try {
      names = readdirSync(dir)
    } catch {
      continue
    }
    for (const name of names) {
      if (!name.endsWith('.json')) continue
      const entry = readInstanceFile(join(dir, name))
      if (entry === null) continue
      if (!isPidAlive(entry.pid)) continue
      if (best === null || entry.startedAt > best.startedAt) best = entry
    }
  }
  if (best !== null) return { origin: best.origin, source: 'registry', instance: best }
  return { origin: null, source: 'none', instance: null }
}

/** Fetch one JSON endpoint, returning a result object instead of throwing. */
async function fetchJson(url, timeoutMs = DEFAULT_TIMEOUT_MS, init = undefined) {
  try {
    const signal = typeof AbortSignal.timeout === 'function' ? AbortSignal.timeout(timeoutMs) : undefined
    const response = await fetch(url, { ...(init ?? {}), ...(signal === undefined ? {} : { signal }) })
    const text = await response.text()
    let json
    try {
      json = JSON.parse(text)
    } catch {
      json = undefined
    }
    return {
      ok: response.ok,
      status: response.status,
      json,
      text,
      error: response.ok ? null : `HTTP ${response.status}`,
    }
  } catch (error) {
    return { ok: false, status: 0, json: undefined, text: '', error: error instanceof Error ? error.message : String(error) }
  }
}

/**
 * Cheap health probe: the proxy's plugin manifest doubles as a liveness check.
 * @param {string} origin - proxy origin.
 * @param {number} [timeoutMs] - request timeout.
 * @returns {Promise<{available:boolean,version:string|null,error:string|null}>} probe result.
 */
export async function probeBili(origin, timeoutMs = MANIFEST_TIMEOUT_MS) {
  if (typeof origin !== 'string' || !/^https?:\/\//.test(origin)) return { available: false, version: null, error: 'invalid origin' }
  const manifest = await fetchJson(`${origin}/__bili/plugin/manifest`, timeoutMs)
  return {
    available: manifest.ok && manifest.json !== undefined,
    version: asText(manifest.json?.version) || null,
    error: manifest.ok ? null : (manifest.error ?? 'manifest unavailable'),
  }
}

/** Normalize one bili session row from `/__bili/stats`. */
export function normalizeSession(raw, sessionId) {
  if (raw === null || typeof raw !== 'object') return null
  const id = asText(raw.id)
  if (id.length === 0) return null
  const blocks = rounded(raw.blocks) ?? 0
  const restores = (rounded(raw.wholeBlockRestores) ?? 0) + (rounded(raw.rangeRestores) ?? 0)
  const title = asText(raw.title) || asText(raw.label) || id
  const idText = typeof sessionId === 'string' ? sessionId : ''
  const shortId = idText.length > 12 ? idText.slice(-12) : idText
  const matched = idText.length > 0
    ? id === idText ||
      asText(raw.label).includes(idText) ||
      title.includes(idText) ||
      id.includes(idText) ||
      idText.includes(id) ||
      id.endsWith(shortId)
    : false
  return {
    id,
    label: asText(raw.label) || null,
    title,
    upstream: asText(raw.upstream) || null,
    protocol: asText(raw.protocol) || null,
    requests: rounded(raw.requests) ?? 0,
    blocks,
    contextTokens: rounded(raw.contextTokens) ?? 0,
    contextWindow: rounded(raw.contextWindow) ?? null,
    inputTokens: rounded(raw.inputTokens) ?? 0,
    cachedTokens: rounded(raw.cachedTokens) ?? 0,
    outputTokens: rounded(raw.outputTokens) ?? 0,
    cacheHitPct: typeof raw.cacheHitPct === 'number' && Number.isFinite(raw.cacheHitPct) ? Math.round(raw.cacheHitPct) : null,
    restores,
    lastSeen: asText(raw.lastSeen) || null,
    lastModel: asText(raw.lastModel) || null,
    matched,
  }
}

/** Aggregate session rows into the KPI totals shown above the table. */
export function summarizeSessions(sessions) {
  const totals = {
    sessions: sessions.length,
    blocks: 0,
    contextTokens: 0,
    inputTokens: 0,
    cachedTokens: 0,
    outputTokens: 0,
    cacheHitPct: null,
    restores: 0,
  }
  for (const session of sessions) {
    totals.blocks += session.blocks
    totals.contextTokens += session.contextTokens
    totals.inputTokens += session.inputTokens
    totals.cachedTokens += session.cachedTokens
    totals.outputTokens += session.outputTokens
    totals.restores += session.restores
  }
  totals.cacheHitPct = totals.inputTokens > 0 ? Math.round((totals.cachedTokens / totals.inputTokens) * 100) : null
  return totals
}

/**
 * Collect billion-context statistics for the UI.
 * @param {string} origin - proxy origin discovered by {@link discoverOrigin}.
 * @param {{sessionId?:string,timeoutMs?:number}} [options] - optional session to highlight and cache report.
 * @returns {Promise<object>} normalized statistics, always resolves.
 */
export async function collectBiliStats(origin, options = {}) {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const empty = { sessions: [], totals: summarizeSessions([]), matchedSessionId: null, cacheReport: null, version: null }
  if (typeof origin !== 'string' || !/^https?:\/\//.test(origin)) {
    return { available: false, origin: null, dashboardUrl: null, message: 'no running billion-context proxy was found', error: 'proxy not running', ...empty }
  }
  const manifest = await fetchJson(`${origin}/__bili/plugin/manifest`, MANIFEST_TIMEOUT_MS)
  const version = asText(manifest.json?.version) || null
  const stats = await fetchJson(`${origin}/__bili/stats`, timeoutMs)
  if (!stats.ok || stats.json === null || typeof stats.json !== 'object') {
    return {
      available: false,
      origin,
      dashboardUrl: `${origin}/__bili/`,
      version,
      message: 'the billion-context proxy did not answer the stats endpoint',
      error: stats.error ?? 'no stats payload',
      ...empty,
    }
  }
  const rawSessions = Array.isArray(stats.json.sessions) ? stats.json.sessions : []
  const sessions = rawSessions.map((raw) => normalizeSession(raw, options.sessionId)).filter((entry) => entry !== null)
  const matched = typeof options.sessionId === 'string'
    ? sessions.find((entry) => entry.matched === true) ?? null
    : sessions.slice().sort((left, right) => asText(right.lastSeen).localeCompare(asText(left.lastSeen)))[0] ?? null
  let cacheReport = null
  if (matched !== null) {
    const report = await fetchJson(`${origin}/__bili/cache-report?session=${encodeURIComponent(matched.id)}`, timeoutMs)
    const text = Array.isArray(report.json?.reports) ? report.json.reports[0]?.report : undefined
    if (typeof text === 'string' && text.length > 0) cacheReport = text.slice(0, MAX_CACHE_REPORT_CHARS)
  }
  return {
    available: true,
    origin,
    dashboardUrl: `${origin}/__bili/`,
    version,
    sessions,
    totals: summarizeSessions(sessions),
    matchedSessionId: matched === null ? null : matched.id,
    cacheReport,
    message: null,
    error: null,
  }
}
