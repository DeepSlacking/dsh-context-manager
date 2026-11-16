/**
 * Context-manager policy vocabulary and pure resolution helpers.
 *
 * Three configuration scopes exist: global defaults, per provider/model
 * overrides, and per-session overrides (the session scope is deliberately
 * limited to capacity and compaction settings). One effective policy is
 * resolved from the three layers, then turned into absolute token budgets.
 *
 * Nothing in this module touches Cordis, the Session log, or the filesystem;
 * the host plugin and the compaction backend share it.
 * @module dsh-context-manager/policy
 */

/** Minimum accepted context capacity (tokens). */
export const MIN_CAPACITY = 4096
/** Capacity assumed when neither the policy nor the routed model declares one. */
export const FALLBACK_CAPACITY = 200000
/** Compaction strategies this plugin can run. */
export const STRATEGIES = ['summarize', 'prune-first', 'prune-only', 'truncate']
/** How the summarization model is chosen. */
export const COMPACTION_MODES = ['current', 'main', 'fixed']
/** Which engine executes compactions: this plugin, auto-detect, or none. */
export const ENGINE_MODES = ['auto', 'plugin', 'off']

/**
 * Fields each scope may set. Session scope is intentionally narrower.
 *
 * Capacity is a property of the routed model, not of the global defaults: the
 * global scope only configures the policy, while a provider/model override may
 * also declare or cap the usable context window, and a session override may set
 * the capacity actually used for that one conversation.
 */
export const GLOBAL_FIELDS = [
  'thresholdPercent',
  'targetPercent',
  'protectPercent',
  'strategy',
  'compactionMode',
  'compactionProvider',
  'compactionModel',
  'auto',
  'engine',
]
export const MODEL_FIELDS = ['capacity', 'maxCapacity', ...GLOBAL_FIELDS.filter((field) => field !== 'engine')]
export const SESSION_FIELDS = ['capacity', 'thresholdPercent', 'targetPercent', 'protectPercent', 'strategy']

/**
 * Defaults applied below every override. Capacity is deliberately absent: it is
 * resolved per route/session from the model declaration and the narrower scopes.
 */
export const DEFAULT_POLICY = Object.freeze({
  thresholdPercent: 80,
  targetPercent: 40,
  protectPercent: 16,
  strategy: 'summarize',
  compactionMode: 'current',
  compactionProvider: '',
  compactionModel: '',
  auto: true,
  engine: 'auto',
})

const integer = (value, name, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${name} must be a finite number`)
  }
  const rounded = Math.round(value)
  if (rounded < min || rounded > max) throw new Error(`${name} must be between ${min} and ${max}`)
  return rounded
}

const percent = (value, name, { min = 1, max = 99 } = {}) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${name} must be a finite number`)
  }
  if (value < min || value > max) throw new Error(`${name} must be between ${min} and ${max}`)
  return Math.round(value * 100) / 100
}

const oneOf = (value, name, choices) => {
  if (!choices.includes(value)) throw new Error(`${name} must be one of: ${choices.join(', ')}`)
  return value
}

/**
 * Normalize a user-supplied patch for one scope.
 * @param {unknown} input - raw patch object.
 * @param {string[]} allowedFields - fields the scope may set.
 * @returns {object} a new patch containing only provided, normalized fields.
 */
export function normalizePatch(input, allowedFields) {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('configuration patch must be an object')
  }
  const patch = {}
  for (const key of Object.keys(input)) {
    if (!allowedFields.includes(key)) throw new Error(`unknown configuration field "${key}" for this scope`)
  }
  const has = (key) => Object.prototype.hasOwnProperty.call(input, key)
  const present = (key) => has(key) && input[key] !== undefined
  if (present('capacity')) {
    patch.capacity = input.capacity === null ? null : integer(input.capacity, 'capacity', { min: MIN_CAPACITY })
  }
  if (present('maxCapacity')) {
    patch.maxCapacity = input.maxCapacity === null ? null : integer(input.maxCapacity, 'maxCapacity', { min: MIN_CAPACITY })
  }
  if (present('thresholdPercent')) patch.thresholdPercent = percent(input.thresholdPercent, 'thresholdPercent', { min: 10, max: 99 })
  if (present('targetPercent')) patch.targetPercent = percent(input.targetPercent, 'targetPercent', { min: 5, max: 95 })
  if (present('protectPercent')) patch.protectPercent = percent(input.protectPercent, 'protectPercent', { min: 0, max: 90 })
  if (present('strategy')) patch.strategy = oneOf(input.strategy, 'strategy', STRATEGIES)
  if (present('compactionMode')) patch.compactionMode = oneOf(input.compactionMode, 'compactionMode', COMPACTION_MODES)
  if (present('compactionProvider')) patch.compactionProvider = String(input.compactionProvider ?? '')
  if (present('compactionModel')) patch.compactionModel = String(input.compactionModel ?? '')
  if (present('auto')) patch.auto = input.auto === true
  if (present('engine')) patch.engine = oneOf(input.engine, 'engine', ENGINE_MODES)
  return patch
}

/**
 * Merge policy layers, later layers winning, ignoring undefined values.
 * @param {...object} layers - policy layers from weakest to strongest.
 * @returns {object} resolved policy values.
 */
export function mergePolicy(...layers) {
  const merged = { ...DEFAULT_POLICY }
  for (const layer of layers) {
    if (layer === null || layer === undefined) continue
    for (const [key, value] of Object.entries(layer)) {
      if (value !== undefined) merged[key] = value
    }
  }
  return merged
}

/**
 * Turn a resolved policy into absolute token budgets for one model route.
 *
 * Capacity priority is: session override > provider/model override > the
 * model's declared maximum (`maxCapacity` override, else the routed window) >
 * the fallback capacity. A capacity is clamped down to the known maximum so a
 * session can never claim more than its route advertises. Percentages are
 * relative to the effective context capacity.
 * @param {object} policy - merged policy values (capacity only from a model/session scope).
 * @param {number|null|undefined} realCapacity - the routed model's declared window.
 * @returns {{capacity:number,maxCapacity:number|null,realCapacity:number|null,thresholdTokens:number,targetTokens:number,protectTokens:number,thresholdPercent:number,targetPercent:number,protectPercent:number,strategy:string,compactionMode:string,compactionProvider:string,compactionModel:string,auto:boolean}}
 */
export function deriveSpec(policy, realCapacity) {
  const declaredMax = Number.isFinite(realCapacity) && realCapacity > 0 ? Math.round(realCapacity) : null
  const maxCapacity = policy.maxCapacity ?? declaredMax
  let capacity = policy.capacity ?? maxCapacity ?? FALLBACK_CAPACITY
  capacity = integer(capacity, 'capacity', { min: MIN_CAPACITY })
  if (maxCapacity !== null && capacity > maxCapacity) capacity = maxCapacity
  const thresholdPercent = percent(policy.thresholdPercent ?? DEFAULT_POLICY.thresholdPercent, 'thresholdPercent', { min: 10, max: 99 })
  const targetPercent = percent(policy.targetPercent ?? DEFAULT_POLICY.targetPercent, 'targetPercent', { min: 5, max: 95 })
  const protectPercent = percent(policy.protectPercent ?? DEFAULT_POLICY.protectPercent, 'protectPercent', { min: 0, max: 90 })
  if (targetPercent > thresholdPercent - 5) {
    throw new Error(`targetPercent (${targetPercent}) must be at least 5 points below thresholdPercent (${thresholdPercent})`)
  }
  if (protectPercent > targetPercent - 5) {
    throw new Error(`protectPercent (${protectPercent}) must be at least 5 points below targetPercent (${targetPercent})`)
  }
  const thresholdTokens = Math.max(1, Math.floor((capacity * thresholdPercent) / 100))
  const targetTokens = Math.max(1, Math.floor((capacity * targetPercent) / 100))
  const protectTokens = Math.max(0, Math.floor((capacity * protectPercent) / 100))
  return {
    capacity,
    maxCapacity,
    realCapacity: declaredMax,
    thresholdPercent,
    targetPercent,
    protectPercent,
    thresholdTokens,
    targetTokens,
    protectTokens,
    strategy: STRATEGIES.includes(policy.strategy) ? policy.strategy : DEFAULT_POLICY.strategy,
    compactionMode: COMPACTION_MODES.includes(policy.compactionMode) ? policy.compactionMode : DEFAULT_POLICY.compactionMode,
    compactionProvider: String(policy.compactionProvider ?? ''),
    compactionModel: String(policy.compactionModel ?? ''),
    auto: policy.auto !== false,
  }
}

/** Largest tool-pairing-balanced tail budget selection for one compaction. */
/**
 * Select the compactable surface range while retaining at least `retainTokens`
 * of the recent tail. Mirrors the shipped backend's selection rule so every
 * compaction keeps tool-call/result pairs balanced.
 * @param {object} session - Session whose current surface is compacted.
 * @param {{nodes: Array<{seq:number,tokens:number}>}} measurement - token measurement of the same surface.
 * @param {number} retainTokens - minimum budget kept verbatim in the tail.
 * @param {(session:object, seq:number)=>boolean} balancedBefore - cut-balance predicate.
 * @returns {{start:number,end:number}|null} inclusive surface seq range, or null when nothing can be compacted safely.
 */
export function selectCompactionRange(session, measurement, retainTokens, balancedBefore) {
  const pricedNodes = measurement.nodes
  if (!Array.isArray(pricedNodes) || pricedNodes.length === 0) return null
  const surfaceNodes = session.surface.nodes
  if (surfaceNodes.length !== pricedNodes.length) throw new Error('compaction: token-meter surface does not match the session surface')
  const head = session.eventAt(surfaceNodes[0])
  const firstIdx = head !== undefined && head.type === 'system/message' ? 1 : 0
  let accumulated = 0
  let keepFromIdx = pricedNodes.length
  for (let index = pricedNodes.length - 1; index >= 0; index -= 1) {
    accumulated += pricedNodes[index].tokens
    keepFromIdx = index
    if (accumulated >= retainTokens) break
  }
  if (keepFromIdx <= firstIdx) return null
  while (keepFromIdx > firstIdx) {
    try {
      if (balancedBefore(session, surfaceNodes[keepFromIdx])) break
    } catch {
      return null
    }
    keepFromIdx -= 1
  }
  if (keepFromIdx <= firstIdx) return null
  return { start: surfaceNodes[firstIdx], end: surfaceNodes[keepFromIdx - 1] }
}

/** True when one injected message came from skill loading rather than the user. */
const isSkillSource = (source) => typeof source?.kind === 'string' && source.kind.startsWith('skill')

const categoryOf = (event) => {
  switch (event?.type) {
    case 'system/message':
      return 'system'
    case 'user/message': {
      const source = event.data?.source
      if (isSkillSource(source)) return 'skill'
      return source !== undefined && source !== null && source.kind !== undefined && source.kind !== 'human' ? 'inject' : 'user'
    }
    case 'developer/message':
      return isSkillSource(event.data?.source) ? 'skill' : 'inject'
    case 'assistant/message':
      return 'assistant'
    case 'tool/result':
      return 'tool'
    default:
      return 'other'
  }
}

/**
 * Price the shadowed surface nodes by content category, for the compression charts.
 * Skill-loading injections (`source.kind` starting with `skill`) are reported
 * as their own `skill` category so the donut can show loaded instructions apart
 * from other injected context.
 * @param {object} session - Session supplying the events behind surface seqs.
 * @param {{nodes: Array<{seq:number,tokens:number}>}} measurement - measurement taken before the compaction.
 * @param {number[]} seqs - inclusive surface seqs being replaced by the summary.
 * @returns {Record<string, number>} token totals per category.
 */
export function categorizeShadowed(session, measurement, seqs) {
  const tokensBySeq = new Map()
  for (const node of measurement.nodes ?? []) tokensBySeq.set(node.seq, node.tokens)
  const categories = {}
  for (const seq of seqs) {
    const event = session.eventAt(seq)
    if (event === undefined) continue
    const category = categoryOf(event)
    categories[category] = (categories[category] ?? 0) + (tokensBySeq.get(seq) ?? 0)
  }
  return categories
}

/**
 * Estimate the shipped backend's automatic trigger for one routed envelope, so
 * a live session can tell whether a custom (earlier) trigger can win.
 * @param {number} contextWindow - routed model window.
 * @param {number} reservedOutput - the request's output reservation.
 * @param {number} [headroom=65536] - shipped pressure headroom.
 * @returns {number} trigger tokens.
 */
export function builtinThresholdTokens(contextWindow, reservedOutput, headroom = 65536) {
  return Math.floor(Math.min(contextWindow * 0.8, contextWindow - reservedOutput - headroom))
}

/**
 * Decide whether a manual compaction may run now.
 *
 * Below the target line a manual compaction would shrink the context for no
 * reason, so it is blocked. Between the target and trigger lines it is allowed
 * only after an explicit confirmation. At or above the trigger line it may run
 * directly.
 * @param {{used:number,thresholdTokens:number,targetTokens:number}} input - measured usage and resolved budgets.
 * @returns {'blocked'|'confirm'|'direct'} gate verdict.
 */
export function manualCompactionGate({ used, thresholdTokens, targetTokens } = {}) {
  const current = Number(used)
  const trigger = Number(thresholdTokens)
  const target = Number(targetTokens)
  if (!Number.isFinite(current) || !Number.isFinite(trigger) || !Number.isFinite(target)) return 'blocked'
  if (current >= trigger) return 'direct'
  if (current >= target) return 'confirm'
  return 'blocked'
}

/**
 * Resolve the engine that should execute compactions.
 *
 * `auto` delegates to billion-context only when that plugin is detected;
 * `plugin` always keeps compaction in this plugin (may conflict with bili);
 * `off` disables compression entirely.
 * @param {string} mode - configured engine mode (`auto` | `plugin` | `off`).
 * @param {boolean} biliDetected - whether the billion-context bundle/proxy is present.
 * @returns {'plugin'|'bili'|'off'} effective engine.
 */
export function effectiveEngine(mode, biliDetected) {
  const normalized = ENGINE_MODES.includes(mode) ? mode : 'auto'
  if (normalized === 'off') return 'off'
  if (normalized === 'plugin') return 'plugin'
  return biliDetected === true ? 'bili' : 'plugin'
}
