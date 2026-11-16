/**
 * Policy-aware compaction backend.
 *
 * Mounted inside every Agent preset's isolated `compaction` group in place of
 * `@deepseek-ai/dsh-compaction-basic`. It reuses the shipped backend's durable
 * transaction (surface validation, checkpoint framing, event log) and replaces
 * only the policy decisions: when to compact, how much to keep, which strategy
 * to run, and which model writes the summary.
 *
 * The summarization directive and checkpoint framing are derived from
 * `@deepseek-ai/dsh-compaction-basic` (MIT) and kept byte-compatible with it so
 * a session compacted by either backend stays readable.
 * @module dsh-context-manager/backend
 */
import { BasicCompactionEngine } from '@deepseek-ai/dsh-compaction-basic'
import { BlockAssembler } from '@deepseek-ai/dsh-llm'
import { toolPairingBalancedBefore } from '@deepseek-ai/dsh-compaction'
import { categorizeShadowed, deriveSpec, selectCompactionRange } from './lib/policy.js'

const SUMMARY_OPEN_TAG = '<compacted-summary>'
const SUMMARY_CLOSE_TAG = '</compacted-summary>'
const DEFAULT_MAX_SUMMARY_TOKENS = 8192

const COMPACTION_INSTRUCTION = [
  'You are now acting as a compaction engine for this AI coding assistant. Condense the conversation ABOVE into a structured checkpoint that lets another model resume the work with no loss of essential context.',
  '',
  'Output EXACTLY the Markdown structure below: keep every section, in order. Use terse bullets, not prose paragraphs. Write "(none)" for an empty section — never drop a section.',
  '',
  '## Primary Request and Intent',
  "- [the user's original and evolving goals; quote verbatim where the exact wording matters]",
  '',
  '## Key Technical Concepts',
  '- [technologies, frameworks, patterns, and conventions in play]',
  '',
  '## Files and Code',
  '- [exact path: why it matters, key changes or snippets]',
  '',
  '## Errors and Fixes',
  '- [error: how it was resolved, plus any related user feedback]',
  '',
  '## Pending Jobs',
  '- [explicitly requested work not yet completed]',
  '',
  '## Current Work',
  '- [precisely what was in progress at this checkpoint]',
  '',
  '## Next Step',
  '- [the single next action, directly in line with the most recent request, or "(none)"]',
  '',
  '## Critical Context',
  '- [decisions and their rationale, constraints, user preferences, open questions, data needed to continue]',
  '',
  'Rules:',
  '- Write concise English engineering prose. Preserve exact file paths, commands, error strings, identifiers, numeric values, function signatures, and syntax fragments.',
  '- Capture user feedback and explicit instructions faithfully, especially corrections.',
  '- Do NOT mention this summarization request or that the context was compacted.',
  '- Output only the checkpoint text: do not call any tool or take any other action.',
  `- If the conversation already contains a ${SUMMARY_OPEN_TAG} block, it is a PRIOR checkpoint. Do not copy it forward verbatim: preserve still-true facts, drop stale ones, and merge newer information into a single consolidated summary under the same structure.`,
].join('\n')

/** Map one terminal summarization failure to its fail-closed error. */
function finishError(finish) {
  switch (finish?.kind) {
    case 'error':
    case 'aborted': {
      const failure = finish.failure ?? {}
      const error = new Error(failure.message ?? 'summarization failed')
      error.code = failure.code
      return error
    }
    case 'max-tokens': {
      const error = new Error('summarization truncated at the token cap (incomplete checkpoint)')
      error.code = 'MAX_TOKENS'
      return error
    }
    default:
      return undefined
  }
}

/** Reject visual output and keep only text blocks before synthesizing a message. */
function summaryText(blocks) {
  if (blocks.some((block) => block?.type === 'image')) {
    const error = new Error('compaction summary cannot contain image output')
    error.code = 'UNSUPPORTED_CONTENT'
    throw error
  }
  return blocks.filter((block) => block?.type === 'text')
}

/** Detach one LLM usage object into a plain JSON-safe copy for the audit log. */
function detachUsage(usage) {
  if (usage === null || typeof usage !== 'object') return undefined
  try {
    return JSON.parse(JSON.stringify(usage))
  } catch {
    return { ...usage }
  }
}

/** Logical token total of one usage object; missing or non-finite fields count as 0. */
function usageTokens(usage) {
  if (usage === null || typeof usage !== 'object') return 0
  let total = 0
  for (const key of ['inputTokens', 'cacheReadTokens', 'cacheWriteTokens', 'outputTokens']) {
    const value = usage[key]
    if (typeof value === 'number' && Number.isFinite(value)) total += value
  }
  return total
}

/** Latest committed `compaction/prune` shadow-price event in one session. */
function latestPruneEvent(session) {
  if (session === undefined || typeof session.snapshotEvents !== 'function') return undefined
  let events = []
  try {
    events = session.snapshotEvents()
  } catch {
    return undefined
  }
  for (let index = events.length - 1; index >= 0; index -= 1) {
    if (events[index]?.type === 'compaction/prune') return events[index]
  }
  return undefined
}

/**
 * Compaction backend that reads its policy from the host `contextManager`
 * service and records every completed compaction for the chart surfaces.
 */
export class ContextManagerCompactionBackend extends BasicCompactionEngine {
  static inject = ['llm', 'tokenMeter', 'sessions', 'contextManager']

  constructor(ctx, config = {}) {
    super(ctx, config)
    /** Marker used by the host half to recognize its own compaction service. */
    this.managerBackend = true
    /** @type {WeakMap<object, {provider:string,model:string,usage?:object}>} */
    this.lastSummaryByAgent = new WeakMap()
  }

  /**
   * Resolve the live policy spec for one agent from its durable route.
   * @param {object} agent - live agent being compacted.
   * @returns {{spec:object,provider:string,model:string}|null} resolved policy or null.
   */
  specFor(agent) {
    const session = agent?.session
    if (session === undefined) return null
    const config = session.requestHeader()?.config
    if (config === undefined || typeof config.provider !== 'string' || typeof config.model !== 'string') return null
    let realCapacity = null
    try {
      const pressure = this.ctx.tokenMeter.contextPressure(session)
      realCapacity = typeof pressure.contextWindow === 'number' ? pressure.contextWindow : null
    } catch {
      realCapacity = null
    }
    const policy = this.ctx.contextManager.policyFor(config.provider, config.model, session.id)
    try {
      return { spec: deriveSpec(policy, realCapacity), provider: config.provider, model: config.model }
    } catch (error) {
      this.ctx.logger.warn(`context-manager: invalid compaction policy for ${config.provider}/${config.model}: ${error instanceof Error ? error.message : String(error)}`)
      return null
    }
  }

  /** Summarization output cap for one resolved spec. */
  summaryMaxTokens(spec) {
    const capacity = Number.isFinite(spec?.capacity) ? spec.capacity : 0
    if (capacity <= 0) return DEFAULT_MAX_SUMMARY_TOKENS
    return Math.max(1024, Math.min(16384, Math.floor(capacity * 0.03)))
  }

  /**
   * Resolve the summarization target and write the checkpoint text.
   * Strategies: `summarize` (LLM), `prune-first` (the caller prunes first and
   * still summarizes when needed), `prune-only` (never reaches this hook — the
   * caller only prunes tool results), `truncate` (deterministic, no model call).
   * @param {object} input - replayed conversation prefix to condense.
   * @param {object} agent - agent owning the compaction.
   * @param {AbortSignal} [signal] - cancellation.
   * @returns {Promise<object>} summary blocks plus call metadata.
   */
  async summarize(input, agent, signal) {
    const info = this.specFor(agent)
    const spec = info?.spec
    const maxTokens = this.summaryMaxTokens(spec)
    if (spec?.strategy === 'truncate') {
      const count = Array.isArray(input?.messages) ? input.messages.length : 0
      const text = `[Earlier conversation truncated to free context: ${Math.max(0, count - 1)} earlier messages were replaced by this note with no model summary. Re-read the working directory or ask the user for details that are no longer shown.]`
      const summary = [{ type: 'text', text }]
      this.lastSummaryByAgent.set(agent, { provider: 'truncate', model: 'deterministic' })
      return { summary, rawOutput: summary, llmStreamCall: false, provider: 'truncate', model: 'deterministic', maxTokens: 0 }
    }
    const target = this.ctx.contextManager.summarizationTarget(agent)
    this.lastSummaryByAgent.set(agent, target)
    const assembler = new BlockAssembler()
    const messages = [
      ...(Array.isArray(input?.messages) ? input.messages : []),
      Object.freeze({ role: 'user', content: [{ type: 'text', text: COMPACTION_INSTRUCTION }] }),
    ]
    const options = {
      provider: target.provider,
      model: target.model,
      messages,
      toolHistory: agent.session.toolHistory(),
      ...input?.tools === undefined ? {} : { tools: [...input.tools] },
      maxTokens,
      sessionId: agent.session.id,
      purpose: 'compaction',
      ...signal === undefined ? {} : { signal },
    }
    for await (const chunk of this.ctx.llm.stream(options)) assembler.push(chunk)
    const error = finishError(assembler.finish)
    if (error !== undefined) throw error
    const usage = detachUsage(assembler.usage)
    this.lastSummaryByAgent.set(agent, usage === undefined ? { ...target } : { ...target, usage })
    const summary = summaryText(assembler.blocks())
    if (!summary.some((block) => typeof block.text === 'string' && block.text.trim().length > 0)) {
      throw new Error('summarization produced no text summary content')
    }
    return {
      summary,
      rawOutput: assembler.blocks(),
      llmStreamCall: true,
      provider: target.provider,
      model: target.model,
      maxTokens,
      ...assembler.usage === undefined ? {} : { usage: assembler.usage },
    }
  }

  /** Record one committed compaction on the host service for the charts. */
  record(agent, info, result, before, after, trigger) {
    if (result === undefined || result === null) return
    try {
      const session = agent.session
      const measurement = this.beforeMeasurement ?? this.ctx.tokenMeter.measure(session)
      const shadowedSeqs = Array.isArray(result.shadowedSeqs) ? result.shadowedSeqs : []
      const target = this.lastSummaryByAgent.get(agent) ?? this.lastSummaryByAgentFallback(agent)
      const usage = detachUsage(target?.usage)
      const record = {
        id: result.compactionId ?? `${session.id}:${Date.now()}`,
        sessionId: String(session.id),
        at: Date.now(),
        trigger,
        strategy: info?.spec?.strategy ?? 'summarize',
        provider: info?.provider ?? '',
        model: info?.model ?? '',
        summarizationProvider: target?.provider ?? '',
        summarizationModel: target?.model ?? '',
        summarizationUsage: usage ?? null,
        summarizationTokens: usage === undefined ? 0 : usageTokens(usage),
        tokensBefore: before,
        tokensAfter: after,
        freedTokens: Math.max(0, before - after),
        shadowedNodes: shadowedSeqs.length,
        shadowedTokens: result.shadowedTokenCount ?? null,
        breakdown: shadowedSeqs.length > 0 ? categorizeShadowed(session, measurement, shadowedSeqs) : {},
        capacity: info?.spec?.capacity ?? null,
        thresholdTokens: info?.spec?.thresholdTokens ?? null,
        targetTokens: info?.spec?.targetTokens ?? null,
        protectTokens: info?.spec?.protectTokens ?? null,
        summaryChars: Array.isArray(result.summary)
          ? result.summary.reduce((total, block) => total + (typeof block?.text === 'string' ? block.text.length : 0), 0)
          : null,
      }
      this.ctx.contextManager.recordCompaction(record)
    } catch (error) {
      this.ctx.logger.warn(`context-manager: could not record compaction: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      this.beforeMeasurement = undefined
    }
  }

  /** Fallback when the summary target was not captured (e.g. overflow recovery). */
  lastSummaryByAgentFallback(agent) {
    try {
      const config = agent.session.requestHeader()?.config
      return config === undefined ? undefined : { provider: config.provider, model: config.model }
    } catch {
      return undefined
    }
  }

  /** Resolve the agent's preset-scoped tool-result pruner, when one is mounted. */
  prunerFor(agent) {
    try {
      const presets = this.ctx.get('agentPresets')
      const scoped = presets?.serviceFor?.(agent, 'toolResultPruner')
      if (scoped !== undefined) return scoped
    } catch {
      /* optional */
    }
    return this.ctx.get('toolResultPruner')
  }

  /**
   * Prune over-budget tool results from the live surface and re-measure.
   * @param {object} agent - agent whose session surface is pruned.
   * @param {object} measurement - measurement taken before pruning.
   * @returns {object} the post-prune measurement, or the input when no pruner is mounted or pruning failed.
   */
  pruneToolResults(agent, measurement) {
    const pruner = this.prunerFor(agent)
    if (pruner === undefined || typeof pruner.pruneSession !== 'function') return measurement
    try {
      pruner.pruneSession(agent.session)
    } catch (error) {
      this.ctx.logger.warn(`context-manager: pruning failed: ${error instanceof Error ? error.message : String(error)}`)
      return measurement
    }
    return this.ctx.tokenMeter.measure(agent.session)
  }

  /**
   * Deterministic manual pruning for the `prune-only` strategy.
   *
   * Never invokes the summarization model. Prices the reduction from the
   * pruner's own latest `compaction/prune` shadow-price event, appends one audit
   * record for the freed tokens, and reports "nothing to summarize" by returning
   * null (which every caller already handles).
   * @param {object} agent - agent whose tool results are pruned.
   * @param {{spec:object,provider:string,model:string}} info - resolved policy.
   * @param {string} trigger - audit trigger for the record.
   * @returns {Promise<null>} always null; the prune itself is the whole strategy.
   */
  async compactPruneOnly(agent, info, trigger) {
    const session = agent.session
    const meter = this.ctx.tokenMeter
    const measurement = meter.measure(session)
    const before = measurement.totalTokens
    const after = this.pruneToolResults(agent, measurement).totalTokens
    if (after >= before) return null
    const pruneEvent = latestPruneEvent(session)
    const shadowedSeqs = Array.isArray(pruneEvent?.data?.shadowedSeqs) ? pruneEvent.data.shadowedSeqs : []
    const range = pruneEvent?.data?.shadowedRange
    const shadowedNodes =
      shadowedSeqs.length > 0
        ? shadowedSeqs.length
        : Number.isFinite(range?.start) && Number.isFinite(range?.end)
          ? Math.max(0, range.end - range.start + 1)
          : 0
    const shadowedTokens = Number.isFinite(pruneEvent?.data?.shadowedTokenCount) ? pruneEvent.data.shadowedTokenCount : 0
    const breakdown = shadowedSeqs.length > 0 ? categorizeShadowed(session, measurement, shadowedSeqs) : {}
    try {
      this.ctx.contextManager.recordCompaction({
        id: `prune:${session.id}:${Date.now()}`,
        sessionId: String(session.id),
        at: Date.now(),
        trigger: trigger ?? 'manual',
        strategy: 'prune-only',
        provider: info?.provider ?? '',
        model: info?.model ?? '',
        summarizationProvider: 'prune',
        summarizationModel: 'tool-result-pruner',
        summarizationUsage: null,
        summarizationTokens: 0,
        tokensBefore: before,
        tokensAfter: after,
        freedTokens: Math.max(0, before - after),
        shadowedNodes,
        shadowedTokens,
        breakdown,
        capacity: info?.spec?.capacity ?? null,
        thresholdTokens: info?.spec?.thresholdTokens ?? null,
        targetTokens: info?.spec?.targetTokens ?? null,
        protectTokens: info?.spec?.protectTokens ?? null,
        summaryChars: null,
      })
    } catch (error) {
      this.ctx.logger.warn(`context-manager: could not record pruning: ${error instanceof Error ? error.message : String(error)}`)
    }
    return null
  }

  /**
   * Trigger policy for automatic step-boundary pressure. Replaces the shipped
   * backend's ratio policy with the resolved capacity/threshold/target/protect
   * budgets and the configured strategy.
   */
  async compactIfNeeded(agent, trigger, signal) {
    const engine = this.ctx.contextManager?.executionEngine?.() ?? 'plugin'
    if (engine !== 'plugin') {
      if (trigger === 'pressure') this.ctx.logger.info(`context-manager: automatic compaction skipped (engine: ${engine})`)
      return null
    }
    if (trigger !== 'pressure') return super.compactIfNeeded(agent, trigger, signal)
    const info = this.specFor(agent)
    if (info === null || info.spec.auto !== true) return null
    const meter = this.ctx.tokenMeter
    let measurement = meter.measure(agent.session)
    this.beforeMeasurement = measurement
    if (measurement.totalTokens < info.spec.thresholdTokens) {
      this.beforeMeasurement = undefined
      return null
    }
    if (info.spec.strategy === 'prune-first' || info.spec.strategy === 'prune-only') {
      measurement = this.pruneToolResults(agent, measurement)
      if (measurement.totalTokens < info.spec.thresholdTokens) {
        this.beforeMeasurement = undefined
        return null
      }
    }
    if (info.spec.strategy === 'prune-only') {
      this.ctx.logger.warn(
        `context-manager: prune-only left session ${agent.session.id} above its trigger (${measurement.totalTokens} > ${info.spec.thresholdTokens}); tool results were pruned but no summary is produced`,
      )
      this.beforeMeasurement = undefined
      return null
    }
    const startTokens = measurement.totalTokens
    this.beforeMeasurement = measurement
    let result = null
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const range = selectCompactionRange(agent.session, measurement, info.spec.protectTokens, toolPairingBalancedBefore)
      if (range === null) break
      const before = measurement.totalTokens
      result = await this.compactRegion(range.start, range.end, agent, signal)
      measurement = meter.measure(agent.session)
      this.record(agent, info, result, before, measurement.totalTokens, 'auto')
      if (measurement.totalTokens <= info.spec.targetTokens) break
    }
    if (result !== null && measurement.totalTokens > info.spec.thresholdTokens) {
      this.ctx.logger.warn(
        `context-manager: compaction kept session ${agent.session.id} above its trigger (${measurement.totalTokens} > ${info.spec.thresholdTokens}; started at ${startTokens})`,
      )
    }
    return result
  }

  /**
   * Manual/idle compaction.
   *
   * `prune-only` never summarizes: it only prunes over-budget tool results and
   * audits the reduction. `prune-first` prunes first and then falls back to the
   * shipped idle compaction when the session is still above its target; when
   * pruning alone already reached the target, no model call is made. The
   * shipped idle path condenses as much as is safe, which satisfies a capacity
   * shrink as well; the strategy and summarization model still come from the
   * policy.
   */
  async compactNow(agent, signal, sourceCommandId) {
    const engine = this.ctx.contextManager?.executionEngine?.() ?? 'plugin'
    if (engine !== 'plugin') {
      this.ctx.logger.info(`context-manager: manual compaction skipped (engine: ${engine})`)
      return null
    }
    const info = this.specFor(agent)
    const trigger = this.pendingTrigger ?? 'manual'
    try {
      if (info !== null && info.spec.strategy === 'prune-only') {
        return await this.compactPruneOnly(agent, info, trigger)
      }
      const meter = this.ctx.tokenMeter
      const initial = meter.measure(agent.session)
      const before = initial.totalTokens
      let measurement = initial
      if (info !== null && info.spec.strategy === 'prune-first') {
        measurement = this.pruneToolResults(agent, initial)
        if (measurement.totalTokens <= info.spec.targetTokens) {
          this.beforeMeasurement = undefined
          return null
        }
      }
      this.beforeMeasurement = measurement
      const result = await super.compactNow(agent, signal, sourceCommandId)
      if (result !== null && result !== undefined) {
        const after = meter.measure(agent.session).totalTokens
        this.record(agent, info, result, before, after, trigger)
      }
      return result
    } finally {
      this.pendingTrigger = undefined
    }
  }

  /**
   * API entry point: compact one idle session so its usage falls below a target.
   * @param {object} agent - idle live agent.
   * @param {{targetTokens?:number,protectTokens?:number,strategy?:string,reason?:string}} [options] - shrink intent.
   * @param {AbortSignal} [signal] - cancellation.
   * @returns {Promise<object|null>} committed compaction result.
   */
  async compactToTarget(agent, options = {}, signal) {
    this.pendingTrigger = typeof options.reason === 'string' ? options.reason : 'manual'
    return this.compactNow(agent, signal)
  }
}

export default ContextManagerCompactionBackend
