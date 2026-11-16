/**
 * Host half of the context-manager bundle.
 *
 * Owns the three configuration scopes (global defaults, per provider/model
 * overrides, per-session overrides), resolves them into absolute token budgets,
 * serves the Web client's JSON API over the Harness connection routes, and
 * owns the profile-wide compaction backend (`dsh-context-manager/backend`),
 * which reads its policy from this service and is mounted at the host plane so
 * one CompactionEngine serves every Agent preset.
 * @module dsh-context-manager
 */
import { Service } from '@deepseek-ai/cordis'
import { ContextManagerCompactionBackend } from './backend.js'
import { PolicyStore } from './lib/store.js'
import {
  DEFAULT_POLICY,
  ENGINE_MODES,
  GLOBAL_FIELDS,
  MODEL_FIELDS,
  SESSION_FIELDS,
  STRATEGIES,
  builtinThresholdTokens,
  categorizeShadowed,
  deriveSpec,
  effectiveEngine,
  manualCompactionGate,
} from './lib/policy.js'
import { RANGE_VALUES, aggregateRecords, filterRecords } from './lib/aggregate.js'
import { collectBiliStats, detectBiliSignals, discoverOrigin, probeBili } from './lib/bili.js'

const ROUTE_PREFIX = '/api/dsh-context-manager/'
const ROUTES = ['state', 'catalog', 'policy', 'global', 'model', 'session', 'compact', 'records', 'bili', 'diagnostics']
const MODEL_INFO_TTL = 60_000
/** Upper bound on records read before range filtering (the store caps the log at 4000). */
const RECORDS_SCAN_LIMIT = 100_000
/** Package rows the gate disables inside every agent preset. */
const PRESET_DISABLED_PACKAGES = new Set([
  '@deepseek-ai/dsh-compaction-basic',
  '@deepseek-ai/dsh-command-compact',
])

const json = (value, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  })

const ok = (value) => json({ ok: true, value })
const fail = (code, message, status = 200) => json({ ok: false, error: { code, message } }, status)

/**
 * Disable the shipped compaction rows inside one preset plugin list, recursively.
 * @param {Array<object>} rows - declared preset plugin rows.
 * @returns {Array<object>} the rewritten list, or the same reference when unchanged.
 */
function rewritePresetPlugins(rows) {
  let changed = false
  const walk = (list) =>
    list.map((row) => {
      if (row === null || typeof row !== 'object') return row
      if (PRESET_DISABLED_PACKAGES.has(row.name)) {
        changed = true
        return { ...row, disabled: true }
      }
      if (row.group === true && Array.isArray(row.config)) {
        const inner = walk(row.config)
        if (inner !== row.config) return { ...row, config: inner }
      }
      return row
    })
  const result = walk(rows)
  return changed ? result : rows
}

const asNumber = (value) => (typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : undefined)

/** Logical token total of one LLM usage object; missing or non-finite fields count as 0. */
function usageTokens(usage) {
  if (usage === null || typeof usage !== 'object') return 0
  let total = 0
  for (const key of ['inputTokens', 'cacheReadTokens', 'cacheWriteTokens', 'outputTokens']) {
    const value = usage[key]
    if (typeof value === 'number' && Number.isFinite(value)) total += value
  }
  return total
}

/**
 * Reject a policy whose resolved budgets are inconsistent.
 * @param {object} policy - merged policy layer about to be saved.
 * @param {number|null} realCapacity - routed model window, when known.
 */
function validatePolicy(policy, realCapacity) {
  deriveSpec(policy, realCapacity)
}

/** Flatten a thrown error and its causes into one diagnostic line. */
function describeError(error) {
  const parts = []
  let current = error
  for (let depth = 0; depth < 4 && current !== null && current !== undefined; depth += 1) {
    parts.push(current instanceof Error ? current.message : String(current))
    current = current instanceof Error ? current.cause : undefined
  }
  return parts.join(' :: ')
}

/** Locate the committed `compaction/summary` event behind one compaction result. */
function findSummaryEvent(session, compactionId) {
  if (compactionId === undefined || compactionId === null) return undefined
  let events = []
  try {
    events = typeof session.snapshotEvents === 'function' ? session.snapshotEvents() : []
  } catch {
    return undefined
  }
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index]
    if (event?.type === 'compaction/summary' && event.data?.compactionId === compactionId) return event
  }
  return undefined
}

/**
 * One host service that owns context/compaction policy for the profile.
 */
export class ContextManagerService extends Service {
  static inject = ['sessions', 'agents', 'tokenMeter', 'llm', 'agentPresets']

  constructor(ctx, config = {}) {
    super(ctx, 'contextManager')
    this.config = config ?? {}
    this.store = new PolicyStore(this.config.stateFile).load()
    /** @type {Map<string, {at:number,contextWindow:number|undefined,defaultMaxTokens:number|undefined}>} */
    this.modelInfoCache = new Map()
    this.backend = undefined
    /** @type {{at:number,bili:object}|undefined} */
    this.engineCache = undefined
  }

  async [Service.init]() {
    const ctx = this.ctx
    this.installGate()
    this.backend = new ContextManagerCompactionBackend(ctx, {})
    this.installCompactCommand()
    this.registerRoutes()
    ctx.logger.info(`context-manager: policy store ${this.store.file}`)
    const wantsStatusFile = typeof this.config.statusFile === 'string' && this.config.statusFile.length > 0
    if (wantsStatusFile) await this.writeStatus()
    this.ctx.inject(['timer'], (child) => {
      child.timeout(() => { this.normalizePresetRows() }, 800)
      child.timeout(() => { this.normalizePresetRows() }, 4000)
      child.timeout(() => { void this.refreshEngine(true) }, 600)
      child.effect(() => child.interval(() => { void this.refreshEngine() }, 15000), 'context-manager: compression engine detection')
      if (wantsStatusFile) {
        child.effect(() => child.interval(() => { this.writeStatus() }, 10000), 'context-manager: diagnostics')
        child.timeout(() => { this.writeStatus() }, 3000)
      }
    })
  }

  /**
   * Claim the profile-wide compaction policy.
   *
   * The shipped compaction backend is mounted inside each Agent preset's
   * isolated `compaction` group, where no Loader patch can address it by id.
   * The gate therefore (a) provides a marker service that the preset
   * declarations wait for, so this listener is installed before their configs
   * resolve, and (b) rewrites every preset declaration's nested plugin list to
   * disable the shipped backend rows. The host-plane backend instantiated by
   * `Service.init` then owns compaction for every agent.
   */
  installGate() {
    const provide = this.ctx.reflect?.provide
    if (typeof provide === 'function') {
      provide.call(this.ctx.reflect, 'contextManagerGate', Object.freeze({ owner: 'dsh-context-manager' }))
    }
    this.ctx.on(
      'internal/config',
      (_raw, next) => {
        const resolved = next()
        if (this.gateDisabled === true) return resolved
        if (resolved === null || typeof resolved !== 'object' || !Array.isArray(resolved.plugins)) return resolved
        this.gateHooks = (this.gateHooks ?? 0) + 1
        const plugins = rewritePresetPlugins(resolved.plugins)
        if (plugins === resolved.plugins) return resolved
        this.gateRewrites = (this.gateRewrites ?? 0) + 1
        return { ...resolved, plugins }
      },
      { global: true },
    )
  }

  /**
   * Rewrite already-materialized preset declarations.
   *
   * The config hook only sees configurations resolved after this plugin
   * loaded; declarations composed earlier in the boot already resolved their
   * nested plugin list. Updating those Loader rows with the same list minus the
   * shipped compaction rows restarts their definitions, so every new Agent
   * revision uses the host-plane backend. Idempotent.
   */
  async normalizePresetRows() {
    this.normalizeRuns = (this.normalizeRuns ?? 0) + 1
    const loader = this.ctx.loader
    if (loader === undefined) return
    let presets = []
    try {
      presets = await this.ctx.agentPresets.list()
    } catch {
      return
    }
    for (const preset of presets) {
      for (const candidate of [`include:preset-${preset.id}`, `preset-${preset.id}`]) {
        let entry
        try {
          entry = loader.resolve(candidate)
        } catch {
          continue
        }
        const config = entry?.options?.config
        if (config === null || typeof config !== 'object' || !Array.isArray(config.plugins)) continue
        const plugins = rewritePresetPlugins(config.plugins)
        if (plugins === config.plugins) break
        try {
          await loader.update(candidate, { config: { ...config, plugins } })
          this.gateRewrites = (this.gateRewrites ?? 0) + 1
          this.normalizeOk = [...(this.normalizeOk ?? []), preset.id]
          this.ctx.logger.info(`context-manager: preset ${preset.id} now uses the context-manager compaction backend`)
        } catch (error) {
          this.normalizeErrors = [...(this.normalizeErrors ?? []), `${preset.id}: ${error instanceof Error ? error.message : String(error)}`]
        }
        break
      }
    }
  }

  /** Replace the shipped `/compact` command that the preset gate disabled. */
  installCompactCommand() {
    this.ctx.inject(['commands'], (child) => {
      child.effect(
        () =>
          child.commands.register({
            name: 'compact',
            description: 'Condense older context now, using the configured compaction policy',
            handler: async (invocation) => {
              try {
                const engine = this.executionEngine()
                if (engine !== 'plugin') {
                  return {
                    kind: 'success',
                    text: engine === 'bili'
                      ? 'Compression is delegated to billion-context; set the compression engine to "this plugin" to use /compact here.'
                      : 'Compression is disabled by the compression engine policy.',
                  }
                }
                const result = await this.backend.compactNow(invocation.agent, invocation.signal)
                if (result === null || result === undefined) {
                  return { kind: 'success', text: 'Nothing could be compacted safely.' }
                }
                const after = this.ctx.tokenMeter.measure(invocation.agent.session).totalTokens
                return {
                  kind: 'success',
                  text: `Context compacted: ${result.shadowedSeqs?.length ?? 0} items condensed (~${result.shadowedTokenCount ?? 0} tokens shadowed); current size ≈ ${after} tokens.`,
                }
              } catch (error) {
                return { kind: 'error', text: error instanceof Error ? error.message : String(error) }
              }
            },
          }),
        'context-manager: /compact command',
      )
    })
  }

  /**
   * Development self-check: proves the host module loaded, the backend subpath
   * resolves, and the browser bundle parses. Enabled only when the row config
   * names a status file.
   */
  async writeStatus() {
    const status = { at: Date.now(), storeFile: this.store.file, routes: ROUTES.length }
    status.backend = this.backend === undefined ? 'missing' : 'ready'
    status.engine = this.engineInfo()
    status.reflect = typeof this.ctx.reflect?.provide
    try {
      const current = this.ctx.get('compaction')
      status.compactionService = current === undefined ? 'absent' : current.managerBackend === true ? 'owned' : 'foreign'
    } catch (error) {
      status.compactionService = error instanceof Error ? error.message : String(error)
    }
    try {
      status.gate = this.ctx.get('contextManagerGate') === undefined ? 'missing' : 'provided'
      status.gateHooks = this.gateHooks ?? 0
      status.gateRewrites = this.gateRewrites ?? 0
    } catch (error) {
      status.gate = error instanceof Error ? error.message : String(error)
    }
    try {
      const entry = this.ctx.loader?.resolve?.('include:preset-standard')
      status.presetInject = entry?.options?.inject ?? null
      status.presetPlugins = Array.isArray(entry?.options?.config?.plugins) ? entry.options.config.plugins.length : null
    } catch (error) {
      status.presetInject = error instanceof Error ? error.message : String(error)
    }
    try {
      const compositions = []
      for (const agent of this.ctx.agents.list()) {
        const inspected = this.ctx.agentPresets.inspectCompositions(agent.ctx)
        for (const entry of inspected) {
          compositions.push({
            id: entry.id,
            compactionModules: entry.modules.filter((mod) => String(mod.moduleName).includes('compaction')).map((mod) => mod.moduleName),
            leaked: entry.leakedServices,
          })
        }
      }
      status.compositions = compositions
    } catch (error) {
      status.compositions = error instanceof Error ? error.message : String(error)
    }
    try {
      status.normalize = { runs: this.normalizeRuns ?? 0, ok: this.normalizeOk ?? [], errors: this.normalizeErrors ?? [] }
      status.revisions = this.ctx.agentPresets.inspectCompositions().map((entry) => ({
        id: entry.id,
        modules: entry.modules.map((mod) => mod.moduleName).filter((name) => String(name).includes('compaction')),
      }))
    } catch (error) {
      status.revisions = error instanceof Error ? error.message : String(error)
    }
    try {
      const presets = await this.ctx.agentPresets.list()
      status.presets = presets.map((preset) => ({ id: preset.id, broken: preset.broken ?? null }))
    } catch (error) {
      status.presets = error instanceof Error ? error.message : String(error)
    }
    try {
      await import('dsh-context-manager/backend')
      status.backendImport = 'ok'
    } catch (error) {
      status.backendImport = error instanceof Error ? error.message : String(error)
    }
    try {
      const { readFileSync } = await import('node:fs')
      const vm = await import('node:vm')
      const source = readFileSync(new URL('./client.js', import.meta.url), 'utf8')
      new vm.Script(source)
      status.clientSyntax = 'ok'
    } catch (error) {
      status.clientSyntax = error instanceof Error ? error.message : String(error)
    }
    try {
      const { writeFileSync } = await import('node:fs')
      writeFileSync(this.config.statusFile, `${JSON.stringify(status, null, 2)}\n`, 'utf8')
    } catch (error) {
      this.ctx.logger.warn(`context-manager: could not write status file: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * Resolve which engine currently executes compactions.
   * @returns {'plugin'|'bili'|'off'} effective engine.
   */
  executionEngine() {
    return this.engineInfo().effective
  }

  /**
   * Current engine mode plus the latest billion-context detection facts.
   * @returns {{mode:'auto'|'plugin'|'off',effective:'plugin'|'bili'|'off',bili:{detected:boolean,signals:{service:boolean,env:boolean,verdict:boolean},origin:string|null,version:string|null,available:boolean,lastCheckedAt:number|null,error:string|null}}} engine status.
   */
  engineInfo() {
    const global = this.store.global()
    const mode = ENGINE_MODES.includes(global.engine) ? global.engine : 'auto'
    const bili = this.engineCache?.bili ?? {
      detected: false,
      signals: { service: false, env: false, verdict: false },
      origin: null,
      version: null,
      available: false,
      lastCheckedAt: null,
      error: null,
    }
    const effective = effectiveEngine(mode, bili.detected === true)
    return { mode, effective, bili }
  }

  /**
   * Re-read billion-context presence and proxy origin.
   * @param {boolean} [force] - bypass the throttle.
   * @returns {Promise<object>} the refreshed engine status.
   */
  async refreshEngine(force = false) {
    const now = Date.now()
    if (force !== true && this.engineCache !== undefined && now - this.engineCache.at < 10_000) return this.engineInfo()
    const signals = detectBiliSignals(this.ctx)
    const discovery = discoverOrigin()
    const bili = {
      detected: signals.detected,
      signals: { service: signals.service, env: signals.env, verdict: signals.verdict },
      origin: discovery.origin,
      version: this.engineCache?.bili?.version ?? null,
      available: false,
      lastCheckedAt: now,
      error: null,
    }
    if (signals.detected && discovery.origin !== null) {
      const probe = await probeBili(discovery.origin)
      bili.available = probe.available
      bili.version = probe.version ?? bili.version
      bili.error = probe.error
    } else if (signals.detected) {
      bili.error = 'billion-context is enabled but no running proxy was found'
    }
    this.engineCache = { at: now, bili }
    return this.engineInfo()
  }

  /** Error raised when another engine (or the disabled policy) owns compression. */
  engineBlockedError(engine) {
    const error = new Error(
      engine === 'bili'
        ? 'compression is currently delegated to billion-context; set the compression engine to "this plugin" (or disable billion-context) to compact from here'
        : 'compression is disabled by the compression engine policy',
    )
    error.code = engine === 'bili' ? 'context-manager/delegated' : 'context-manager/disabled'
    return error
  }

  /**
   * Read billion-context statistics for the client.
   * @param {{sessionId?:string,refresh?:boolean}} body - request options.
   * @returns {Promise<object>} normalized statistics plus the engine status.
   */
  async getBiliStats(body = {}) {
    const force = body.refresh === true || this.engineCache === undefined
    await this.refreshEngine(force)
    const engine = this.engineInfo()
    const emptyTotals = {
      sessions: 0,
      blocks: 0,
      contextTokens: 0,
      inputTokens: 0,
      cachedTokens: 0,
      outputTokens: 0,
      cacheHitPct: null,
      restores: 0,
    }
    if (engine.bili.origin === null) {
      return {
        available: false,
        engine,
        origin: null,
        dashboardUrl: null,
        version: engine.bili.version,
        sessions: [],
        totals: emptyTotals,
        matchedSessionId: null,
        cacheReport: null,
        message: engine.bili.detected
          ? 'billion-context is enabled but its proxy is not running, so no statistics are available yet'
          : 'billion-context is not enabled in this profile',
      }
    }
    const sessionId = typeof body.sessionId === 'string' && body.sessionId.length > 0 ? body.sessionId : undefined
    const stats = await collectBiliStats(engine.bili.origin, { sessionId })
    if (this.engineCache !== undefined) {
      this.engineCache.bili.available = stats.available === true
      this.engineCache.bili.version = stats.version ?? this.engineCache.bili.version
      this.engineCache.bili.error = stats.available === true ? null : (stats.error ?? 'proxy unavailable')
      this.engineCache.bili.lastCheckedAt = Date.now()
    }
    return { ...stats, engine: this.engineInfo() }
  }

  /** Register the client JSON routes on the shared connection channel. */
  registerRoutes() {
    this.ctx.inject(['connection'], (child) => {
      child.effect(() => {
        const disposers = ROUTES.map((route) =>
          child.connection.fetch.register({
            path: `${ROUTE_PREFIX}${route}`,
            methods: ['POST'],
            requestBody: 'buffered',
            fetch: (request) => this.handleRoute(route, request),
          }),
        )
        return () => {
          for (const dispose of disposers) dispose()
        }
      })
    })
  }

  /**
   * Validate and dispatch one client request.
   * @param {string} route - route name below the shared prefix.
   * @param {Request} request - buffered JSON request.
   * @returns {Promise<Response>} JSON envelope.
   */
  async handleRoute(route, request) {
    let body = {}
    try {
      const text = await request.text()
      body = text.length > 0 ? JSON.parse(text) : {}
    } catch {
      return fail('bad-request', 'request body is not JSON')
    }
    try {
      switch (route) {
        case 'state':
          return ok(this.getState())
        case 'catalog':
          return ok(await this.getCatalog())
        case 'policy':
          return ok(await this.queryPolicy(body))
        case 'global':
          return ok(this.setGlobal(body.patch ?? body.config ?? null))
        case 'model':
          return ok(this.setModel(body))
        case 'session':
          return ok(await this.setSession(body))
        case 'compact':
          return ok(await this.compactSession(body))
        case 'records':
          return ok(this.getRecords(body))
        case 'bili':
          return ok(await this.getBiliStats(body))
        case 'diagnostics':
          return ok(await this.getDiagnostics())
        default:
          return fail('not-found', `unknown route ${route}`)
      }
    } catch (error) {
      const message = describeError(error)
      return fail(error?.code ?? 'context-manager/error', message)
    }
  }

  /* ── configuration API ─────────────────────────────────────────────────── */

  /** Whole configuration snapshot for the management page. */
  getState() {
    return {
      file: this.store.file,
      updatedAt: this.store.state.updatedAt,
      loadError: this.store.loadError,
      defaults: DEFAULT_POLICY,
      global: this.store.global(),
      models: this.store.state.models,
      sessions: this.store.state.sessions,
      allowed: { global: GLOBAL_FIELDS, model: MODEL_FIELDS, session: SESSION_FIELDS, strategies: STRATEGIES },
      engine: this.engineInfo(),
      counts: {
        models: Object.keys(this.store.state.models).length,
        sessions: Object.keys(this.store.state.sessions).length,
        records: this.store.state.records.length,
      },
    }
  }

  setGlobal(patch) {
    if (patch !== null) validatePolicy({ ...this.store.global(), ...patch }, null)
    this.store.setGlobal(patch)
    return { global: this.store.global() }
  }

  setModel(body) {
    const provider = String(body.provider ?? '')
    const model = String(body.model ?? '')
    const hasPatch = Object.prototype.hasOwnProperty.call(body, 'patch')
    const patch = hasPatch ? body.patch : body.clear === true ? null : undefined
    if (patch === undefined) throw new Error('model patch is required')
    if (patch !== null) validatePolicy({ ...this.store.global(), ...this.store.model(provider, model), ...patch }, null)
    this.store.setModel(provider, model, patch)
    return { provider, model, override: this.store.model(provider, model) }
  }

  /* ── route/model catalog ───────────────────────────────────────────────── */

  /** Cached adapter metadata for one exact route. */
  async modelInfo(provider, model) {
    const key = `${provider}/${model}`
    const cached = this.modelInfoCache.get(key)
    if (cached !== undefined && Date.now() - cached.at < MODEL_INFO_TTL) return cached
    let contextWindow
    let defaultMaxTokens
    try {
      const info = await this.ctx.llm.resolveModelInfo(provider, model)
      contextWindow = info?.context?.contextWindow
      defaultMaxTokens = info?.defaultMaxTokens
    } catch {
      contextWindow = undefined
      defaultMaxTokens = undefined
    }
    const entry = { at: Date.now(), contextWindow, defaultMaxTokens }
    this.modelInfoCache.set(key, entry)
    return entry
  }

  /**
   * Provider/model catalog for the per-model settings surface.
   * @returns {Promise<{providers: Array<object>}>} routes with their declared windows and overrides.
   */
  async getCatalog() {
    const providers = []
    const seen = new Set()
    const routes = []
    const pushProvider = (provider) => {
      if (seen.has(provider)) return
      seen.add(provider)
      providers.push(provider)
    }
    try {
      for (const info of this.ctx.llm.listProviders()) pushProvider(info.id ?? info.provider ?? String(info))
    } catch {
      /* adapter registry unavailable */
    }
    try {
      for (const info of this.ctx.llm.listConfigurableProviders()) {
        if (typeof info?.provider === 'string') pushProvider(info.provider)
        else if (typeof info?.id === 'string') pushProvider(info.id)
      }
    } catch {
      /* optional */
    }
    for (const provider of providers) {
      let models = []
      try {
        models = await this.ctx.llm.listModels(provider)
      } catch {
        models = []
      }
      for (const model of models.slice(0, 400)) {
        const info = await this.modelInfo(provider, model.id)
        const override = this.store.model(provider, model.id)
        routes.push({
          provider,
          model: model.id,
          name: model.name ?? model.id,
          description: model.description,
          contextWindow: info.contextWindow ?? null,
          defaultMaxTokens: info.defaultMaxTokens ?? null,
          override,
        })
      }
    }
    routes.sort((left, right) => left.provider.localeCompare(right.provider) || left.model.localeCompare(right.model))
    return { providers, routes }
  }

  /* ── policy resolution ─────────────────────────────────────────────────── */

  /** Synchronous policy merge for one route and optional session. */
  policyFor(provider, model, sessionId) {
    return this.store.merged(provider, model, sessionId)
  }

  /** Policy layer that supplied the effective values ("session" | "model" | "global"). */
  policySource(provider, model, sessionId) {
    if (sessionId !== undefined && Object.keys(this.store.session(sessionId)).length > 0) return 'session'
    if (Object.keys(this.store.model(provider, model)).length > 0) return 'model'
    return 'global'
  }

  /**
   * Resolve the effective spec for a live session from its durable route.
   * @param {object} session - live Session.
   * @param {object} [header] - optional request envelope override.
   * @returns {Promise<object|null>} spec plus route facts, or null before any routed request.
   */
  async describeSession(session, header = session.requestHeader()) {
    const config = header?.config
    if (config === undefined || typeof config.provider !== 'string' || config.provider.length === 0) return null
    const provider = config.provider
    const model = config.model
    const info = await this.modelInfo(provider, model)
    const pressure = this.ctx.tokenMeter.contextPressure(session)
    const realCapacity = info.contextWindow ?? asNumber(pressure.contextWindow) ?? null
    const policy = this.policyFor(provider, model, session.id)
    const spec = deriveSpec(policy, realCapacity)
    const measurement = this.ctx.tokenMeter.measure(session, header)
    const reservedOutput = asNumber(config.maxTokens) ?? asNumber(info.defaultMaxTokens) ?? 0
    return {
      sessionId: session.id,
      provider,
      model,
      policy,
      policySource: this.policySource(provider, model, session.id),
      spec,
      realCapacity,
      reservedOutput,
      builtinThreshold: realCapacity === null ? null : builtinThresholdTokens(realCapacity, reservedOutput, 65536),
      measurement,
      sessionOverride: this.store.session(session.id),
      modelOverride: this.store.model(provider, model),
    }
  }

  /** Find a live agent/session by id, or throw a readable error. */
  liveAgent(sessionId) {
    const id = String(sessionId ?? '')
    if (id.length === 0) throw new Error('sessionId is required')
    const agent = this.ctx.agents.get(id)
    if (agent !== undefined) return agent
    throw new Error(`session ${id} has no live agent; open it in the current window to manage it`)
  }

  /** Resolve a policy query without requiring a live session. */
  async queryPolicy(body) {
    if (typeof body.sessionId === 'string' && body.sessionId.length > 0) {
      const agent = this.ctx.agents.get(body.sessionId)
      if (agent !== undefined) {
        const described = await this.describeSession(agent.session)
        if (described === null) return { sessionId: body.sessionId, resolved: null, note: 'session has no routed request yet' }
        return { sessionId: body.sessionId, provider: described.provider, model: described.model, spec: described.spec, policy: described.policy, policySource: described.policySource, realCapacity: described.realCapacity }
      }
      const session = this.ctx.sessions.get(body.sessionId)
      if (session === undefined) throw new Error(`session ${body.sessionId} is not loaded`)
      const described = await this.describeSession(session)
      if (described === null) return { sessionId: body.sessionId, resolved: null, note: 'session has no routed request yet' }
      return { sessionId: body.sessionId, provider: described.provider, model: described.model, spec: described.spec, policy: described.policy, policySource: described.policySource, realCapacity: described.realCapacity }
    }
    const provider = String(body.provider ?? '')
    const model = String(body.model ?? '')
    if (provider.length === 0 || model.length === 0) throw new Error('provider and model are required')
    const info = await this.modelInfo(provider, model)
    const policy = this.policyFor(provider, model, undefined)
    return {
      provider,
      model,
      policy,
      policySource: this.policySource(provider, model, undefined),
      spec: deriveSpec(policy, info.contextWindow ?? null),
      realCapacity: info.contextWindow ?? null,
    }
  }

  /* ── session state and mutation ─────────────────────────────────────────── */

  /** Client-facing live state for one session. */
  async getSessionState(sessionId) {
    const agent = this.liveAgent(sessionId)
    const described = await this.describeSession(agent.session)
    if (described === null) {
      return {
        sessionId: agent.session.id,
        routed: false,
        sessionOverride: this.store.session(agent.session.id),
        engine: this.engineInfo(),
        note: 'no routed model request yet; the policy becomes effective with the first request',
      }
    }
    const used = described.measurement.totalTokens
    const percentOf = (tokens) => (described.spec.capacity > 0 ? Math.round((tokens / described.spec.capacity) * 1000) / 10 : null)
    return {
      sessionId: agent.session.id,
      routed: true,
      provider: described.provider,
      model: described.model,
      policySource: described.policySource,
      sessionOverride: described.sessionOverride,
      modelOverride: described.modelOverride,
      engine: this.engineInfo(),
      realCapacity: described.realCapacity,
      builtinThreshold: described.builtinThreshold,
      usedTokens: used,
      surfaceTokens: described.measurement.surfaceTokens,
      pressureTokens: asNumber(this.ctx.tokenMeter.contextPressure(agent.session).pressureTokens) ?? null,
      percent: percentOf(used),
      capacity: described.spec.capacity,
      maxCapacity: described.spec.maxCapacity,
      defaultCapacity: described.spec.maxCapacity ?? described.spec.realCapacity ?? null,
      thresholdPercent: described.spec.thresholdPercent,
      targetPercent: described.spec.targetPercent,
      protectPercent: described.spec.protectPercent,
      thresholdTokens: described.spec.thresholdTokens,
      targetTokens: described.spec.targetTokens,
      manualCompact: manualCompactionGate({
        used,
        thresholdTokens: described.spec.thresholdTokens,
        targetTokens: described.spec.targetTokens,
      }),
      protectTokens: described.spec.protectTokens,
      strategy: described.spec.strategy,
      compactionMode: described.spec.compactionMode,
      compactionProvider: described.spec.compactionProvider,
      compactionModel: described.spec.compactionModel,
      auto: described.spec.auto,
      running: typeof agent.status === 'string' ? agent.status : null,
      shrunk: described.spec.capacity < used,
    }
  }

  /**
   * Read or mutate one live session's override.
   *
   * `reset: true` takes precedence over patch handling: it clears the override
   * and, when the current usage exceeds the route's default capacity, compacts
   * once after confirmation. Other calls keep the patch/clear/read contract, and
   * a capacity shrink below current usage asks for confirmation before applying
   * and compacting.
   */
  async setSession(body) {
    const sessionId = String(body.sessionId ?? '')
    const agent = this.liveAgent(sessionId)
    const ids = agent.session.id
    const engine = this.executionEngine()
    if (body.reset === true) return this.resetSession(agent, body)
    const patch = body.patch ?? null
    const readOnly = !Object.prototype.hasOwnProperty.call(body, 'patch') && body.clear !== true
    if (readOnly) {
      return { ...(await this.getSessionState(ids)), sessionOverride: this.store.session(ids) }
    }
    if (patch === null || body.clear === true) {
      this.store.setSession(ids, null)
      return { sessionId: ids, sessionOverride: {}, cleared: true, state: await this.getSessionState(ids) }
    }
    const described = await this.describeSession(agent.session)
    const requestedCapacity = typeof patch.capacity === 'number' ? Math.round(patch.capacity) : undefined
    if (requestedCapacity !== undefined && described !== null) {
      const used = described.measurement.totalTokens
      if (requestedCapacity < used && body.confirm !== true) {
        return {
          sessionId: ids,
          needsConfirmation: true,
          reason: 'shrink-below-usage',
          currentTokens: used,
          targetCapacity: requestedCapacity,
          targetTokens: described.spec.targetTokens,
          message: engine === 'plugin'
            ? `Current context usage (${used} tokens) exceeds the requested capacity (${requestedCapacity} tokens). Confirm to compact once, then apply the smaller capacity.`
            : `Current context usage (${used} tokens) exceeds the requested capacity (${requestedCapacity} tokens). Compression is delegated to ${engine}, so confirming applies the smaller capacity without a compaction here.`,
        }
      }
      const maxCapacity = described.spec.maxCapacity
      if (maxCapacity !== null && requestedCapacity > maxCapacity) {
        throw new Error(`capacity ${requestedCapacity} exceeds this route's supported maximum ${maxCapacity}`)
      }
    }
    validatePolicy(
      described === null
        ? { ...this.store.global(), ...this.store.model('', ''), ...patch }
        : { ...this.store.global(), ...this.store.model(described.provider, described.model), ...patch },
      described?.realCapacity ?? null,
    )
    this.store.setSession(ids, patch)
    let compaction = null
    const shrunk = requestedCapacity !== undefined && described !== null && requestedCapacity < described.measurement.totalTokens && body.confirm === true
    if (shrunk && engine === 'plugin') {
      // The override is already saved, so re-describe to price the new capacity.
      const fresh = await this.describeSession(agent.session)
      compaction = await this.performCompaction(agent, fresh ?? described, body.signal, 'capacity-shrink')
    }
    return {
      sessionId: ids,
      sessionOverride: this.store.session(ids),
      applied: true,
      compaction,
      delegated: engine === 'plugin' ? undefined : true,
      engine: this.engineInfo(),
      state: await this.getSessionState(ids),
    }
  }

  /**
   * Clear one session override and, when required, compact back to the route's
   * default capacity in a single confirmed step.
   *
   * The default capacity is the routed model's supported maximum. A session that
   * currently uses more than that cannot simply drop its override, so the first
   * call returns a confirmation request and the confirmed call clears the
   * override, then compacts once (bypassing the manual gate).
   * @param {object} agent - live agent owning the session.
   * @param {object} body - `{ confirm?: boolean, signal?: AbortSignal }`.
   * @returns {Promise<object>} cleared/confirmed outcome plus the resulting state.
   */
  async resetSession(agent, body) {
    const sessionId = agent.session.id
    const engine = this.executionEngine()
    const described = await this.describeSession(agent.session)
    if (described === null) {
      this.store.setSession(sessionId, null)
      return { sessionId, reset: true, cleared: true, compaction: null }
    }
    const defaultTarget = described.spec.maxCapacity ?? described.realCapacity ?? null
    const used = described.measurement.totalTokens
    if (defaultTarget !== null && used > defaultTarget && body.confirm !== true && engine === 'plugin') {
      return {
        sessionId,
        needsConfirmation: true,
        reason: 'reset-requires-compaction',
        currentTokens: used,
        targetCapacity: defaultTarget,
        message: `Resetting to the default capacity (${defaultTarget} tokens) requires one compaction because current usage (${used}) is above it. Continue?`,
      }
    }
    this.store.setSession(sessionId, null)
    let compaction = null
    if (defaultTarget !== null && used > defaultTarget && engine === 'plugin') {
      compaction = await this.performCompaction(agent, described, body.signal, 'reset-default')
    }
    const state = await this.getSessionState(sessionId)
    return {
      sessionId,
      reset: true,
      cleared: true,
      compaction,
      delegated: engine === 'plugin' ? undefined : true,
      engine: this.engineInfo(),
      compacted: compaction?.compacted ?? false,
      beforeTokens: compaction?.beforeTokens ?? used,
      afterTokens: compaction?.afterTokens ?? (state.usedTokens ?? used),
      freedTokens: compaction?.freedTokens ?? 0,
      record: compaction?.record ?? null,
      state,
    }
  }

  /**
   * Compact one live session through its host-plane compaction backend.
   *
   * Manual API compaction is gated: below the target line it is rejected,
   * between the target and trigger lines it needs an explicit confirmation, and
   * at/above the trigger line it proceeds directly.
   * @param {object} body - `{ sessionId, confirm?, reason?, signal? }`.
   * @returns {Promise<object>} compaction outcome plus the gate verdict.
   */
  async compactSession(body) {
    const sessionId = String(body.sessionId ?? '')
    const agent = this.liveAgent(sessionId)
    const engine = this.executionEngine()
    if (engine !== 'plugin') throw this.engineBlockedError(engine)
    const described = await this.describeSession(agent.session)
    const used = described?.measurement.totalTokens ?? this.ctx.tokenMeter.measure(agent.session).totalTokens
    const gate =
      described === null
        ? 'direct'
        : manualCompactionGate({
            used,
            thresholdTokens: described.spec.thresholdTokens,
            targetTokens: described.spec.targetTokens,
          })
    if (gate === 'blocked') {
      const error = new Error(
        `Context usage (${used} tokens) is below the target line (${described.spec.targetTokens} tokens); manual compaction is available only after the target line is reached.`,
      )
      error.code = 'context-manager/below-target'
      throw error
    }
    if (gate === 'confirm' && body.confirm !== true) {
      return {
        sessionId,
        needsConfirmation: true,
        reason: 'between-target-and-threshold',
        usedTokens: used,
        targetTokens: described.spec.targetTokens,
        thresholdTokens: described.spec.thresholdTokens,
        message: `Context usage has not reached the trigger line (${described.spec.thresholdTokens}), but it has reached the target line (${described.spec.targetTokens}). Compacting now may go below the target; continue?`,
      }
    }
    const outcome = await this.performCompaction(agent, described, body.signal, body.reason ?? 'manual')
    return { ...outcome, gate }
  }

  /**
   * Run one compaction and build the API result body.
   *
   * Shared by the gated manual route and the internal capacity-shrink /
   * reset-default flows, whose intent is already established, so it never
   * re-prompts or re-gates.
   * @param {object} agent - live agent being compacted.
   * @param {object|null} described - resolved session description, when available.
   * @param {AbortSignal} [signal] - cancellation.
   * @param {string} reason - audit trigger stored on the compaction record.
   * @returns {Promise<{sessionId:string,compacted:boolean,beforeTokens:number,afterTokens:number,freedTokens:number,summaryTokens:number|null,record:object|null,state:object}>}
   */
  async performCompaction(agent, described, signal, reason) {
    const service = this.backend
    if (service === undefined) throw new Error('the context-manager compaction backend is not ready')
    const engine = this.executionEngine()
    if (engine !== 'plugin') throw this.engineBlockedError(engine)
    const sessionId = agent.session.id
    const before = described?.measurement.totalTokens ?? this.ctx.tokenMeter.measure(agent.session).totalTokens
    const result = await service.compactToTarget(agent, { reason }, signal ?? new AbortController().signal)
    const after = this.ctx.tokenMeter.measure(agent.session).totalTokens
    const reduced = after < before
    // A deterministic strategy (prune-only) returns no compaction result but
    // still shrinks the window and appends its own audit record; report it as
    // a completed, auditable action instead of "nothing happened".
    const latestRecord = reduced ? this.store.records(sessionId, 1)[0] : undefined
    const record = result === null || result === undefined
      ? (latestRecord !== undefined && latestRecord.at >= Date.now() - 30000 ? latestRecord : null)
      : this.toRecord(agent, described, result, before, after, reason)
    const completed = (result !== null && result !== undefined) || reduced
    return {
      sessionId,
      compacted: completed,
      beforeTokens: before,
      afterTokens: after,
      freedTokens: Math.max(0, before - after),
      summaryTokens: result?.shadowedTokenCount === undefined ? null : Math.max(0, before - after),
      record,
      strategy: described?.spec?.strategy ?? null,
      state: await this.getSessionState(sessionId),
    }
  }

  /** Append one audit record for a compaction that just committed. */
  toRecord(agent, described, result, beforeTokens, afterTokens, trigger) {
    const session = agent.session
    const shadowedSeqs = Array.isArray(result?.shadowedSeqs) ? result.shadowedSeqs : []
    const measurement = described?.measurement ?? this.ctx.tokenMeter.measure(session)
    const breakdown = shadowedSeqs.length > 0 ? categorizeShadowed(session, measurement, shadowedSeqs) : {}
    const spec = described?.spec ?? null
    const summaryEvent = findSummaryEvent(session, result?.compactionId)
    const usage = summaryEvent?.data?.usage
    return {
      id: result?.compactionId ?? `${session.id}:${Date.now()}`,
      sessionId: String(session.id),
      at: Date.now(),
      trigger,
      strategy: spec?.strategy ?? 'summarize',
      provider: described?.provider ?? '',
      model: described?.model ?? '',
      summarizationProvider: summaryEvent?.data?.provider ?? result?.provider ?? '',
      summarizationModel: summaryEvent?.data?.model ?? result?.model ?? '',
      summarizationUsage: usage ?? null,
      summarizationTokens: usage === undefined || usage === null ? 0 : usageTokens(usage),
      tokensBefore: beforeTokens,
      tokensAfter: afterTokens,
      freedTokens: Math.max(0, beforeTokens - afterTokens),
      shadowedNodes: Array.isArray(result?.shadowedSeqs) ? result.shadowedSeqs.length : 0,
      shadowedTokens: result?.shadowedTokenCount ?? null,
      breakdown,
      capacity: spec?.capacity ?? null,
      thresholdTokens: spec?.thresholdTokens ?? null,
      targetTokens: spec?.targetTokens ?? null,
      protectTokens: spec?.protectTokens ?? null,
      summaryChars: Array.isArray(result?.summary)
        ? result.summary.reduce((total, block) => total + (typeof block?.text === 'string' ? block.text.length : 0), 0)
        : null,
    }
  }

  /** Record one auto compaction performed by the policy backend. */
  recordCompaction(entry) {
    if (entry === null || typeof entry !== 'object') return
    this.store.appendRecord(entry)
  }

  /**
   * Resolve the configured summarization target for one agent.
   * Modes: `current` follows the latest routed request, `main` follows the
   * agent's initial/primary model, `fixed` uses the configured pair.
   * @param {object} agent - live agent whose compaction is running.
   * @returns {{provider:string,model:string}} target route.
   */
  summarizationTarget(agent) {
    const session = agent.session
    const config = this.store.merged(
      session.requestHeader()?.config?.provider ?? '',
      session.requestHeader()?.config?.model ?? '',
      session.id,
    )
    const latest = session.requestHeader()?.config
    const main = agent.options
    const pick = config.compactionMode
    if (pick === 'fixed' && config.compactionProvider.length > 0 && config.compactionModel.length > 0) {
      return { provider: config.compactionProvider, model: config.compactionModel }
    }
    if (pick === 'main' && typeof main?.provider === 'string' && typeof main?.model === 'string') {
      return { provider: main.provider, model: main.model }
    }
    if (latest !== undefined && typeof latest.provider === 'string' && typeof latest.model === 'string') {
      return { provider: latest.provider, model: latest.model }
    }
    if (typeof main?.provider === 'string' && typeof main?.model === 'string') {
      return { provider: main.provider, model: main.model }
    }
    throw new Error('no provider/model is available for summarization')
  }

  /* ── records and diagnostics ───────────────────────────────────────────── */

  /**
   * Windowed audit-log query used by the management page's charts.
   *
   * Reads the whole (bounded) record log for the optional session, filters it
   * to the requested host-local calendar range, aggregates the filtered set,
   * and only then trims the response array, so totals always describe the full
   * range instead of the visible page.
   * @param {{sessionId?:string, range?:string, limit?:number}} body - optional filters.
   * @returns {{sessionId:string|null,range:string,since:number|null,until:number,records:object[],totals:object}} page plus range-wide totals.
   */
  getRecords(body) {
    const sessionId = typeof body.sessionId === 'string' && body.sessionId.length > 0 ? body.sessionId : undefined
    const limit = Math.max(1, asNumber(body.limit) ?? 200)
    const range = body.range === undefined ? 'all' : body.range
    // Fail fast with the shared range vocabulary before reading the full log;
    // filterRecords re-validates through rangeBounds for non-HTTP callers.
    if (!RANGE_VALUES.includes(range)) {
      const error = new Error(`range must be one of: ${RANGE_VALUES.join(', ')}`)
      error.code = 'context-manager/invalid-range'
      throw error
    }
    const raw = this.store.records(sessionId, RECORDS_SCAN_LIMIT)
    const filtered = filterRecords(raw, range)
    return {
      sessionId: sessionId ?? null,
      range: filtered.range,
      since: filtered.since,
      until: filtered.until,
      records: filtered.records.slice(0, limit),
      totals: aggregateRecords(filtered.records),
    }
  }

  async getDiagnostics() {
    let gate = 'missing'
    try {
      gate = this.ctx.get('contextManagerGate') === undefined ? 'missing' : 'provided'
    } catch {
      gate = 'missing'
    }
    let revisions = []
    try {
      revisions = this.ctx.agentPresets.inspectCompositions().map((entry) => ({
        id: entry.id,
        compactionModules: entry.modules.map((mod) => mod.moduleName).filter((name) => String(name).includes('compaction')),
        leakedServices: entry.leakedServices,
      }))
    } catch {
      revisions = []
    }
    const sessions = []
    for (const agent of this.ctx.agents.list()) {
      try {
        sessions.push(await this.getSessionState(agent.session.id))
      } catch (error) {
        sessions.push({ sessionId: agent.session.id, error: error instanceof Error ? error.message : String(error) })
      }
    }
    return {
      ok: true,
      file: this.store.file,
      updatedAt: this.store.state.updatedAt,
      loadError: this.store.loadError,
      backend: this.backend === undefined ? 'missing' : 'ready',
      engine: this.engineInfo(),
      gate,
      normalize: { runs: this.normalizeRuns ?? 0, applied: this.normalizeOk ?? [], errors: this.normalizeErrors ?? [] },
      revisions,
      sessions,
    }
  }
}

export default ContextManagerService
