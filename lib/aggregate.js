/**
 * Pure range and aggregation helpers for the compaction audit log.
 *
 * The record log stores one entry per committed compaction. The management page
 * asks for a named time window and derives its KPI cards and compression charts
 * from these helpers, so this module must stay free of Cordis, the store, and
 * the clock: `now` is always injected. Every return value is plain JSON.
 * @module dsh-context-manager/aggregate
 */

/** Time ranges the management page may request, weakest to widest. */
export const RANGE_VALUES = ['today', '7d', '30d', 'all']

const finiteNumber = (value) => (typeof value === 'number' && Number.isFinite(value) ? value : undefined)

/**
 * Resolve one named range to inclusive epoch-ms bounds on host-local calendar
 * days. `today` starts at local midnight today, `7d` at local midnight six days
 * before today and `30d` at local midnight 29 days before today, so each window
 * contains exactly its whole number of calendar days. `all` has no lower bound.
 * @param {'today'|'7d'|'30d'|'all'} range - requested range name.
 * @param {number} [now=Date.now()] - reference instant in epoch ms.
 * @returns {{range:string,since:number|null,until:number}} inclusive bounds.
 * @throws {Error & {code:string}} code `context-manager/invalid-range` for an unknown range.
 */
export function rangeBounds(range, now = Date.now()) {
  if (!RANGE_VALUES.includes(range)) {
    const error = new Error(`range must be one of: ${RANGE_VALUES.join(', ')}`)
    error.code = 'context-manager/invalid-range'
    throw error
  }
  const instant = typeof now === 'number' && Number.isFinite(now) ? now : Date.now()
  if (range === 'all') return { range, since: null, until: instant }
  // Local-calendar arithmetic via Date setters stays correct across DST changes.
  const start = new Date(instant)
  start.setHours(0, 0, 0, 0)
  const daysBack = range === 'today' ? 0 : range === '7d' ? 6 : 29
  if (daysBack > 0) start.setDate(start.getDate() - daysBack)
  return { range, since: start.getTime(), until: instant }
}

/**
 * Keep only records whose `at` falls inside one named range.
 * @param {object[]} records - audit records, any order.
 * @param {'today'|'7d'|'30d'|'all'} range - requested range name.
 * @param {number} [now=Date.now()] - reference instant in epoch ms.
 * @returns {{range:string,since:number|null,until:number,records:object[]}} matching records.
 */
export function filterRecords(records, range, now = Date.now()) {
  const bounds = rangeBounds(range, now)
  const kept = []
  for (const record of Array.isArray(records) ? records : []) {
    if (record === null || typeof record !== 'object') continue
    const at = finiteNumber(record.at)
    if (at === undefined) continue
    if (bounds.since !== null && at < bounds.since) continue
    if (at > bounds.until) continue
    kept.push(record)
  }
  return { range: bounds.range, since: bounds.since, until: bounds.until, records: kept }
}

/**
 * Aggregate a filtered record set into the management page's totals.
 *
 * Legacy records may lack `breakdown`, usage, or `freedTokens`; missing values
 * count as 0 and non-numeric values are ignored. `strategies` is keyed by the
 * configured strategy (falling back to `unknown`), and `models` by the
 * summarization route, including deterministic ones such as `truncate` and
 * `prune`. Records with neither a summarization provider nor model are skipped
 * instead of producing the empty `/` key.
 * @param {object[]} records - audit records (already filtered by time range).
 * @returns {{count:number,sessions:number,freedTokens:number,avgFreedPerSession:number,summarizationTokens:number,breakdown:Object<string,number>,strategies:Object<string,{count:number,freedTokens:number}>,models:Object<string,{count:number,summarizationTokens:number}>}} totals.
 */
export function aggregateRecords(records) {
  const totals = {
    count: 0,
    sessions: 0,
    freedTokens: 0,
    avgFreedPerSession: 0,
    summarizationTokens: 0,
    breakdown: {},
    strategies: {},
    models: {},
  }
  const sessions = new Set()
  for (const record of Array.isArray(records) ? records : []) {
    if (record === null || typeof record !== 'object' || Array.isArray(record)) continue
    totals.count += 1
    if (record.sessionId !== undefined && record.sessionId !== null && record.sessionId !== '') {
      sessions.add(String(record.sessionId))
    }
    const freedTokens = finiteNumber(record.freedTokens) ?? 0
    totals.freedTokens += freedTokens
    const summarizationTokens = finiteNumber(record.summarizationTokens) ?? 0
    totals.summarizationTokens += summarizationTokens
    const breakdown = record.breakdown
    if (breakdown !== null && typeof breakdown === 'object' && !Array.isArray(breakdown)) {
      for (const [category, tokens] of Object.entries(breakdown)) {
        const value = finiteNumber(tokens)
        if (value !== undefined) totals.breakdown[category] = (totals.breakdown[category] ?? 0) + value
      }
    }
    const strategy = String(record.strategy ?? 'unknown')
    const strategyTotals = totals.strategies[strategy] ?? { count: 0, freedTokens: 0 }
    strategyTotals.count += 1
    strategyTotals.freedTokens += freedTokens
    totals.strategies[strategy] = strategyTotals
    const provider = typeof record.summarizationProvider === 'string' ? record.summarizationProvider.trim() : ''
    const model = typeof record.summarizationModel === 'string' ? record.summarizationModel.trim() : ''
    if (provider !== '' || model !== '') {
      const key = `${provider}/${model}`
      const modelTotals = totals.models[key] ?? { count: 0, summarizationTokens: 0 }
      modelTotals.count += 1
      modelTotals.summarizationTokens += summarizationTokens
      totals.models[key] = modelTotals
    }
  }
  totals.sessions = sessions.size
  totals.avgFreedPerSession = sessions.size > 0 ? Math.round(totals.freedTokens / sessions.size) : 0
  return totals
}
