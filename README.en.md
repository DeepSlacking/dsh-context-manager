# dsh-context-manager

[中文](README.md) · English

A DeepSeek Harness (DSH) plugin that manages **context capacity** and **compaction policy** in one place.

Scope (three levels; a later level overrides an earlier one):

| Level | Applies to | Settings |
| --- | --- | --- |
| Global default | Sessions with no model/session override | Compaction engine, threshold, target threshold, session protection range, strategy, summarization model, auto-compaction switch (**capacity is no longer global**) |
| Provider/model override | Every session using that provider + model | Model maximum, custom context capacity, threshold, target threshold, protection range, strategy, summarization model, auto-compaction switch |
| Current-session override | The current session only | Custom context capacity, threshold, target threshold, protection range, strategy |

**Capacity precedence**: current-session custom capacity > provider/model capacity > **default = the model's supported maximum**
(model maximum is the same-named field in the model override; when empty it is the window the route declares, e.g. 1M).
Suggested shortcuts: **128K / 256K / 512K / 1M**.

Percentages are relative to the **effective context capacity**; absolute token budgets are derived from capacity × percentage (trigger = threshold %, target = target-threshold %, protection = session protection range). After compaction, usage falls back to the target line while the most recent raw text inside the protection range is always kept.

## Features

- **Policy takeover**: the plugin provides its own `compaction` engine on the host plane (a `BasicCompactionEngine` subclass reusing its persistence transactions and checkpoint format) and disables the officially mounted compaction backend inside every Agent preset at load time (gate service + preset `inject` waits + Loader `internal/config` rewrite), without duplicating the preset list.
- **Compaction engine** (global): `auto` (default; steps aside when billion-context is detected) / `plugin` (always this plugin) / `off` (no compaction, usage display only). When delegated, the plugin neither auto- nor manually compacts, in-session buttons grey out and the API returns `context-manager/delegated`; `/compact` reports that bili has taken over.
- **billion-context takeover and stats**: detects bili's gate service, the `BILLION_CONTEXT_NATIVE` environment variable and `__BILI_DSH_COMPACTION_VERDICT__`, and locates the running proxy via `BILLION_CONTEXT_PROXY` or the instance registry. While delegated it shows bili's own compaction stats (folded blocks, context/input/cache/output tokens, cache hit rate, restores, and the cache-report folding economics) live from the proxy's loopback endpoints `/__bili/stats`, `/__bili/cache-report`, `/__bili/plugin/manifest`, plus an *Open bili console* entry. This plugin's own history stays available and is labelled "before bili takeover".
- **Four compaction strategies** (each explained in the UI):
  - `summarize` — the summarization model produces a structured checkpoint; most information preserved, one model call;
  - `prune-first` — prune oversized tool output first, summarize only if the trigger line is still reached; cheaper;
  - `prune-only` — prune tool output only, never summarize; stops with a notice if still over;
  - `truncate` — deterministic truncation, no model call; earliest turns replaced by a short note, cheapest and most lossy.
- **Custom context capacity**: grow (up to the model maximum) or shrink; shrinking below current usage asks for confirmation and compacts first.
- **Summarization model**: follow the current model / the primary model / a fixed provider+model.
- **Manual compaction admission**: below the target line the button is greyed out and the server refuses; between target and trigger the button works and asks for confirmation ("below the trigger line but at/over the target"); at or above the trigger it runs directly.
- **Reset to default** (in session): clears the session override after confirmation; if usage is above the default capacity it compacts once first.
- **Compaction charts** (global default page / records page): ranges **Today / Last 7 days / Last 30 days / All** (default 7 days), five rows:
  1. sessions · compactions, total freed tokens, average freed per session;
  2. before/after comparison per compaction;
  3. donut chart of compacted content types (categories and colors aligned with the Context Insight plugin's token stats: system prompt / user messages / injected context / skill injection / assistant messages / tool results / other);
  4. strategy distribution beside summarization-model distribution, with tokens spent per summarization call;
  5. the compaction log.
- **Capacity slider**: model and session custom capacities also get a slider beside the number input, from **10% of the model maximum to the model maximum**, step 1000, synced live with the input.
- **Visuals**: `#F2F2F2` light-grey page background, white cards with shadows, uniform 10px spacing, provider/model card grid, icons on section titles, 14px minimum font size.
- **`/compact` command**: re-registered by the plugin after the gate disables the official preset command; compacts immediately with the current strategy.
- **Entry points**: sidebar page *Context management*, Settings page *Context & compaction*, in-session *Context* view tab, and `/compact`.

## Layout

```
index.js            host plugin: policy store, JSON API, gate, host-plane compaction engine, /compact
backend.js          policy-aware compaction backend (BasicCompactionEngine subclass)
lib/policy.js       strategy vocabulary, merge/validate, absolute budgets, admission, compactable range, content classes
lib/aggregate.js    time-range bounds, filtering and aggregation of records (pure)
lib/bili.js         billion-context detection, proxy origin discovery, stats adaptation (Node built-ins only)
lib/store.js        three-scope config + compaction audit records (atomic writes, safe migration)
client.js           browser plugin: five slots, card UI, charts, confirmation dialogs
cordis.patch.yml    bundle patch: insert the host row + make four preset declarations wait for the gate
locale/{en,zh}.json plugin-manager metadata
icon.svg            plugin icon
```

## Install

```
plugin_manager action=install_bundle target=D:\DSH-workspace\dsh-context-manager
```

The gate rewrites preset declarations at load time. Existing agents keep the composition they started with; the backend takeover, automatic thresholds and summarization-model choice apply fully to **sessions created after installation**. Existing sessions can still use manual compaction (subject to the admission rules), capacity shrink/reset, and the host-plane engine's "earlier trigger" auto-compaction.

## Config storage

`$DSH_HOME/storages/dsh-context-manager/policy.json` (atomic writes; obsolete fields such as the removed global `capacity` are dropped on read). Up to 4000 compaction audit records are kept.

## JSON API

All under `/api/dsh-context-manager/*` (Connection exact routes, owner-browser cookie only, POST JSON):

`state` / `catalog` / `policy` / `global` / `model` / `session` / `compact` / `records` / `bili` / `diagnostics`.

`state`, `session` and `diagnostics` also return `engine`:
`{mode:'auto'|'plugin'|'off', effective:'plugin'|'bili'|'off', bili:{detected, signals:{service,env,verdict}, origin, version, available, lastCheckedAt, error}}`.

`POST /bili` accepts `{sessionId?, refresh?}` and returns bili stats: `{available, engine, origin, dashboardUrl, version, sessions, totals, matchedSessionId, cacheReport, message?}`;
each session carries `blocks`, `contextTokens`, `inputTokens`, `cachedTokens`, `outputTokens`, `cacheHitPct`, `restores`, `lastSeen` and more. When the proxy is not running or not enabled it returns `available:false` with a readable reason instead of an error.

`POST /records` accepts `{sessionId?, range?: 'today'|'7d'|'30d'|'all', limit?}` (default `all`, limit 200) and returns
`{sessionId, range, since, until, records, totals}`; `totals` covers the whole filtered range (independent of limit):
`count`, `sessions`, `freedTokens`, `avgFreedPerSession`, `summarizationTokens`, `breakdown`,
`strategies: {name:{count,freedTokens}}`, `models: {provider/model:{count,summarizationTokens}}`.
Records gained `summarizationUsage` / `summarizationTokens` (0 for old records).

Key semantics:

- `POST /compact`: below the target line returns `{ok:false,error:{code:'context-manager/below-target',…}}`; between target and trigger without confirmation returns `{ok:true,value:{needsConfirmation:true,reason:'between-target-and-threshold',…}}`; with confirmation or at/above the trigger it runs and returns before/after data and the record. When the engine is `bili` or `off` it returns `context-manager/delegated` / `context-manager/disabled`.
- `POST /session` supports `{reset:true,confirm?}`: clears the session override, asking first when needed (`reason:'reset-requires-compaction'`), then compacts automatically below the default capacity.
- `getSessionState` additionally exposes `defaultCapacity` and `manualCompact` (`blocked` / `confirm` / `direct`).

Response envelope: `{ok:true,value}` or `{ok:false,error:{code,message}}`; error messages carry the cause chain.

## Known limits

- Visual verification in a browser needs a human on a connected page; automated coverage includes host loading, gate effect, policy/capacity/admission/reset APIs, client slot registration and strings in a Node stub, and the bundle entering the browser boot graph.
- If the route goes through a third-party "compaction proxy" (such as the local billion-context proxy), its server may reject summarization requests with `purpose: compaction`. Use `truncate` / `prune-first` / `prune-only`, or point "summarization model" at a direct model (needs the matching API key).
- Context-overflow recovery still uses the official fallback path (which may summarize); `/compact` is an explicit manual action and is not subject to the manual-admission rules.
- Summarization token stats come from the `compaction/summary` usage recorded at compaction time; records created before this plugin version have no such data, so the model chart shows 0 and is labelled "no token records".
- Compaction targets "protection range + target percentage"; if indivisible units make the target unreachable, the record keeps the actual result and a warning is logged.
- The policy store is a plugin-private file and is not written into the profile's `cordis.patch.yml`.
- **Never let two compactors write the same history**: bili compacts outbound requests and keeps client history, while this plugin commits session compaction checkpoints; bili's own guidance also requires DSH's native compaction to be off while it is active. The default `auto` steps aside when bili is detected, but both bundle patches rewrite preset `inject` (the Loader replaces by layer), so reload the session or restart Harness when switching. Running `plugin` mode alongside bili is a forced combination and may be rejected by bili.
- bili's stats endpoints are internal APIs (currently adapted to `billion-context@0.1.213`); fields may change after a proxy upgrade. The plugin degrades gracefully on missing fields and never blocks compaction.
- Verification scope for the bili coexistence path: detection/discovery/stats adaptation have unit tests (with a mock proxy), and engine delegation plus API refusal were tested live; the combination "bili actually enabled while running model traffic" was not tested on this machine (it would change the current session's model route), so enable bili, reopen a session and observe once before deciding which engine to keep.

## License

MIT License, Copyright (c) 2026 dsh-context-manager contributors.

Free to use, modify and redistribute under the MIT license; see [LICENSE](LICENSE) for the full text.
