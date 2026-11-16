/**
 * Durable JSON store for context-manager configuration and compaction records.
 *
 * The store keeps three configuration scopes plus a bounded compaction audit
 * log (the source of the compression charts). Everything is plain JSON and is
 * written atomically so a crash cannot truncate the file.
 * @module dsh-context-manager/store
 */
import fs from 'node:fs'
import path from 'node:path'
import { dshHomePath } from '@deepseek-ai/dsh-home-paths'
import { MODEL_FIELDS, SESSION_FIELDS, GLOBAL_FIELDS, mergePolicy, normalizePatch } from './policy.js'

const MAX_RECORDS = 4000
const VERSION = 1

const emptyState = () => ({
  version: VERSION,
  global: {},
  models: {},
  sessions: {},
  records: [],
  updatedAt: 0,
})

/** Normalize a provider/model route into its store key. */
export const routeKey = (provider, model) => `${provider ?? ''}/${model ?? ''}`

/**
 * Load, validate, mutate, and persist the plugin's own JSON state.
 */
export class PolicyStore {
  /**
   * @param {string} [file] - explicit state file; defaults to `$DSH_HOME/storages/dsh-context-manager/policy.json`.
   */
  constructor(file) {
    this.file = file ?? dshHomePath('storages', 'dsh-context-manager', 'policy.json')
    /** @type {ReturnType<typeof emptyState>} */
    this.state = emptyState()
    this.listeners = new Set()
  }

  /** Read the file from disk, tolerating absence and corrupt JSON. */
  load() {
    try {
      const raw = fs.readFileSync(this.file, 'utf8')
      const parsed = JSON.parse(raw)
      if (parsed !== null && typeof parsed === 'object') {
        this.state = {
          version: VERSION,
          global: sanitizeScope(parsed.global, GLOBAL_FIELDS),
          models: sanitizeModels(parsed.models),
          sessions: sanitizeModels(parsed.sessions, SESSION_FIELDS),
          records: Array.isArray(parsed.records) ? parsed.records.filter(isRecord).slice(-MAX_RECORDS) : [],
          updatedAt: Number.isFinite(parsed.updatedAt) ? parsed.updatedAt : 0,
        }
      }
    } catch (error) {
      if (error?.code !== 'ENOENT') {
        this.state = emptyState()
        this.loadError = error instanceof Error ? error.message : String(error)
      }
    }
    return this
  }

  /** Persist the current state atomically. */
  save() {
    const directory = path.dirname(this.file)
    fs.mkdirSync(directory, { recursive: true })
    const temporary = `${this.file}.${process.pid}.${Date.now()}.tmp`
    fs.writeFileSync(temporary, `${JSON.stringify(this.state, null, 2)}\n`, 'utf8')
    fs.renameSync(temporary, this.file)
    for (const listener of this.listeners) {
      try {
        listener()
      } catch {
        /* listener failures never break a committed write */
      }
    }
  }

  /** Subscribe to committed writes; returns the disposer. */
  onChange(listener) {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  /** Read one scope's raw override object. */
  global() {
    return this.state.global
  }

  /** Read one model route's raw override object. */
  model(provider, model) {
    return this.state.models[routeKey(provider, model)] ?? {}
  }

  /** Read one session's raw override object. */
  session(sessionId) {
    return this.state.sessions[String(sessionId)] ?? {}
  }

  /** Merge the three scopes for one route and session. */
  merged(provider, model, sessionId) {
    return mergePolicy(this.state.global, this.model(provider, model), this.session(sessionId))
  }

  /** Replace (or clear with null) the global defaults. */
  setGlobal(patch) {
    this.state.global = patch === null ? {} : normalizePatch(patch, GLOBAL_FIELDS)
    this.state.updatedAt = Date.now()
    this.save()
    return this.state.global
  }

  /** Replace (or clear with null) one provider/model override. */
  setModel(provider, model, patch) {
    if (typeof provider !== 'string' || provider.length === 0) throw new Error('provider is required')
    if (typeof model !== 'string' || model.length === 0) throw new Error('model is required')
    const key = routeKey(provider, model)
    if (patch === null) delete this.state.models[key]
    else this.state.models[key] = normalizePatch(patch, MODEL_FIELDS)
    this.state.updatedAt = Date.now()
    this.save()
    return this.state.models[key] ?? {}
  }

  /** Replace (or clear with null) one session override. */
  setSession(sessionId, patch) {
    const key = String(sessionId)
    if (patch === null) delete this.state.sessions[key]
    else this.state.sessions[key] = normalizePatch(patch, SESSION_FIELDS)
    this.state.updatedAt = Date.now()
    this.save()
    return this.state.sessions[key] ?? {}
  }

  /** Append one compaction audit record and trim the log. */
  appendRecord(record) {
    this.state.records.push(record)
    if (this.state.records.length > MAX_RECORDS) {
      this.state.records.splice(0, this.state.records.length - MAX_RECORDS)
    }
    this.state.updatedAt = Date.now()
    this.save()
  }

  /** Read the audit log, newest-first, optionally limited to one session. */
  records(sessionId, limit = 200) {
    const filtered = sessionId === undefined ? this.state.records : this.state.records.filter((record) => record.sessionId === String(sessionId))
    return filtered.slice(-Math.max(1, limit)).reverse()
  }
}

function sanitizeScope(raw, fields) {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return {}
  // Migration-safe read: keep only known fields, so a value written by an older
  // plugin version (for example a global `capacity` that no longer exists)
  // cannot invalidate the whole scope. Unknown fields are dropped; invalid
  // values are dropped one by one instead of discarding valid siblings.
  const known = {}
  for (const field of fields) {
    if (Object.prototype.hasOwnProperty.call(raw, field) && raw[field] !== undefined) known[field] = raw[field]
  }
  try {
    return normalizePatch(known, fields)
  } catch {
    const salvaged = {}
    for (const [field, value] of Object.entries(known)) {
      try {
        Object.assign(salvaged, normalizePatch({ [field]: value }, fields))
      } catch {
        /* drop only the offending field */
      }
    }
    return salvaged
  }
}

function sanitizeModels(raw, fields = MODEL_FIELDS) {
  if (raw === null || typeof raw !== 'object') return {}
  const result = {}
  for (const [key, value] of Object.entries(raw)) {
    if (key.length === 0) continue
    const sanitized = sanitizeScope(value, fields)
    if (Object.keys(sanitized).length > 0) result[key] = sanitized
  }
  return result
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && typeof value.sessionId === 'string' && Number.isFinite(value.at)
}
