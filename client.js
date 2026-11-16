/**
 * Browser half of the context-manager bundle.
 *
 * Registers four surfaces and reads everything from the host JSON API:
 *  - `main` panel page (+ `sidebar.panellist` row): global defaults, per
 *    provider/model overrides, and the compression charts;
 *  - `settings.section`: the same global defaults as a Settings page;
 *  - `conversation.view`: the per-session capacity/compaction controls;
 *  - `settings.section.icon` / panel glyph: one small original SVG.
 *
 * No Harness client package is imported; controls are plain React and the host
 * theme tokens carry all colors.
 */
window.__ModuleLoader__.load({
  id: 'dsh-context-manager',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const NS = 'dsh-context-manager'

    const EN = {
      'panel.title': 'Context management',
      'panel.subtitle': 'Capacity and compaction policy · global, per provider/model, and per session',
      'settings.section.title': 'Context & compaction',
      'tab.defaults': 'Global defaults',
      'tab.models': 'Per provider/model',
      'tab.records': 'Compression records',
      'tab.session': 'Context',
      'tab.session.hint': 'Manage this session only: capacity, thresholds, protected history, and strategy.',
      'common.save': 'Save',
      'common.saved': 'Saved',
      'common.saving': 'Saving…',
      'common.reset': 'Use defaults',
      'common.clear': 'Clear override',
      'common.refresh': 'Refresh',
      'common.cancel': 'Cancel',
      'common.close': 'Close',
      'common.loading': 'Loading…',
      'common.empty': 'No data yet',
      'common.unknown': 'Unknown',
      'common.tokens': 'tokens',
      'common.none': 'Not set',
      'common.inherited': 'Inherited',
      'field.capacity': 'Context capacity',
      'field.capacity.hint': 'Effective window used for every percentage below. Blank follows the routed model window.',
      'field.maxCapacity': 'Model supported maximum',
      'field.maxCapacity.hint': 'Upper bound for capacity. Never allow capacity above the model maximum.',
      'field.threshold': 'Compaction threshold',
      'field.threshold.hint': 'Start an automatic compaction when usage reaches this share of capacity.',
      'field.target': 'Target compaction threshold',
      'field.target.hint': 'How far a compaction should reduce usage; must stay below the threshold.',
      'field.protect': 'Session protection range',
      'field.protect.hint': 'Recent conversation kept verbatim (share of capacity). Must stay below the target.',
      'field.strategy': 'Compaction strategy',
      'field.strategy.summarize': 'Summary',
      'field.strategy.prune-first': 'Prune tool output, then summarize',
      'field.strategy.truncate': 'Truncate without model',
      'field.model': 'Compaction model',
      'field.model.current': 'Follow the current model',
      'field.model.main': 'Use the primary model',
      'field.model.fixed': 'Use a fixed model',
      'field.model.provider': 'Provider',
      'field.model.model': 'Model',
      'field.auto': 'Automatic compaction',
      'field.auto.hint': 'Off keeps manual compaction available but never compacts automatically.',
      'scope.global': 'Global default',
      'scope.model': 'Provider/model override',
      'scope.session': 'Session override',
      'source.session': 'session override',
      'source.model': 'provider/model override',
      'source.global': 'global default',
      'defaults.title': 'Global defaults',
      'defaults.desc': 'Thresholds, strategy and compaction model used when no provider/model or session override applies.',
      'models.title': 'Per provider/model overrides',
      'models.desc': 'Each model card edits the override used by every session routed to that provider and model.',
      'models.search': 'Filter provider or model…',
      'models.empty': 'No provider routes are currently registered.',
      'models.declared': 'Declared window',
      'models.override': 'Override',
      'models.select': 'Edit this route',
      'records.title': 'Compression records',
      'records.desc': 'Every compaction this profile performed, newest first.',
      'records.total': '{n} compactions',
      'records.freed': '{n} tokens freed',
      'chart.beforeAfter': 'Before / after by compaction',
      'chart.breakdown': 'Compressed content types',
      'chart.strategies': 'Strategy distribution',
      'chart.models': 'Models used for summaries',
      'chart.freed': 'Freed tokens',
      'chart.before': 'Before',
      'chart.after': 'After',
      'chart.noRecords': 'No compaction has run yet. Records appear here as soon as automatic or manual compaction happens.',
      'cat.system': 'System prompt',
      'cat.inject': 'Injected context',
      'cat.user': 'User messages',
      'cat.assistant': 'Assistant messages',
      'cat.tool': 'Tool results',
      'cat.other': 'Other',
      'table.at': 'When',
      'table.session': 'Session',
      'table.trigger': 'Trigger',
      'table.strategy': 'Strategy',
      'table.model': 'Summary model',
      'table.before': 'Before',
      'table.after': 'After',
      'table.freed': 'Freed',
      'table.nodes': 'Nodes',
      'trigger.auto': 'Automatic',
      'trigger.manual': 'Manual',
      'trigger.capacity-shrink': 'Capacity shrink',
      'session.title': 'Context window',
      'session.desc': 'Changes here apply only to this session.',
      'session.used': '{used} of {capacity} used ({percent}%)',
      'session.threshold': 'threshold {value}',
      'session.target': 'target {value}',
      'session.protect': 'protected {value}',
      'session.source': 'Effective policy: {source}',
      'session.real': 'Model window {value}',
      'session.apply': 'Apply to this session',
      'session.compact': 'Compact now',
      'session.compacting': 'Compacting…',
      'session.reset': 'Reset to default',
      'session.notRouted': 'This session has no routed request yet. Send a message first.',
      'session.noteExpand': 'For a session that already exists, a larger capacity cannot delay the built-in trigger; the custom thresholds fully apply to sessions created after install.',
      'shrink.title': 'Shrink needs a compaction',
      'shrink.body': 'Current usage ({used} tokens) is above the requested capacity ({capacity} tokens). Confirm to run one compaction with the selected strategy, then apply the smaller capacity.',
      'shrink.confirm': 'Compact and apply',
      'compaction.done': 'Compacted: {before} → {after} tokens ({freed} freed).',
      'compaction.none': 'Nothing could be compacted safely.',
      'marker.used': 'used',
      'marker.threshold': 'trigger',
      'marker.target': 'target',
      'error.load': 'Could not read context management data',
      'error.save': 'Could not save',
      'capacity.title': 'Custom context capacity',
      'capacity.default': 'Default: {value} (model maximum)',
      'capacity.recommended': 'Recommended',
      'capacity.useDefault': 'Use default',
      'capacity.maxField': 'Model supported maximum',
      'capacity.maxHint': 'Upper bound for capacity. Blank follows the declared model window ({value}).',
      'defaults.capacityNotePrefix': 'Context capacity has no global setting. Configure it per model in ',
      'defaults.capacityNoteSuffix': '.',
      'capacity.priorityNote': 'Priority: session capacity → provider/model capacity → model maximum.',
      'models.cardDeclared': 'declared {value}',
      'models.cardMax': 'max {value}',
      'models.cardCapacity': 'capacity {value}',
      'models.cardDefault': 'default',
      'models.cardOverride': 'override',
      'models.editTitle': 'Edit {name}',
      'models.pickHint': 'Pick a model card to edit its override.',
      'strategy.hint': 'How a compaction reduces the context window, and what it costs.',
      'strategy.summarize.title': 'Model summary',
      'strategy.summarize.desc': 'A compaction model replaces older history with a structured checkpoint. Keeps the most detail; one model call.',
      'strategy.prune-first.title': 'Prune, then summarize',
      'strategy.prune-first.desc': 'Trims oversized tool output first, then summarizes only if usage is still above the trigger. Cheaper.',
      'strategy.prune-only.title': 'Prune only',
      'strategy.prune-only.desc': 'Only trims oversized tool output; never asks the model. Stops with a warning when trimming is not enough.',
      'strategy.truncate.title': 'Deterministic truncate',
      'strategy.truncate.desc': 'No model call: replaces older history with a short explanation. Cheapest; details are lost.',
      'ghost.target': 'target',
      'manual.gate.blocked': 'Unavailable: usage {used} is below the target line {target}.',
      'manual.gate.hint': '{used} used · trigger {threshold} · target {target}',
      'manual.confirmTitle': 'Compact below the trigger line?',
      'manual.confirmBody': 'Context usage ({used}) has not reached the trigger line ({threshold}), but it has reached the target line ({target}). Compacting now may drop below the target. Continue?',
      'reset.button': 'Reset to default',
      'reset.confirmTitle': 'Reset this session to defaults?',
      'reset.confirmBody': 'This clears the session override and restores the model default capacity ({capacity}). No conversation data is deleted. Continue?',
      'reset.compactionTitle': 'Reset needs one compaction',
      'reset.compactionBody': 'The default capacity ({capacity}) is below current usage ({used}). Confirming resets the override and runs one compaction with the current strategy. Continue?',
      'reset.done': 'Session override cleared. Default capacity {capacity}.',
      'common.confirm': 'Confirm',
      'common.continue': 'Continue',
      'session.defaultCapacity': 'default {value}',
      'session.lines': 'trigger {threshold} · target {target}',
      'field.strategy.prune-only': 'Prune only',
      'trigger.reset-default': 'Reset to default',
      'range.label': 'Time range',
      'range.today': 'Today',
      'range.7d': 'Last 7 days',
      'range.30d': 'Last 30 days',
      'range.all': 'All',
      'range.tenPercent': '10%',
      'range.maximum': 'max',
      'capacity.slider': 'Capacity slider',
      'kpi.sessionsCompactions': 'Sessions · compactions',
      'kpi.totalFreed': 'Total context freed',
      'kpi.avgFreed': 'Average freed per session',
      'chart.breakdownHint': 'Token share of the replaced content, by category',
      'chart.strategiesHint': 'Compaction count · tokens freed',
      'chart.modelsHint': 'Tokens spent by each summarization model',
      'chart.compressedTotal': 'Compressed',
      'chart.legacyNoUsage': 'no token usage recorded',
      'table.summaryTokens': 'Summary tokens',
      'cat.skill': 'Skill injections',
      'catDesc.system': 'System prompt and its fixed prefix',
      'catDesc.user': 'Messages the user sent',
      'catDesc.inject': 'Injected context from plugins, tools or reminders',
      'catDesc.skill': 'Content injected by skill loading',
      'catDesc.assistant': 'Assistant replies and tool calls',
      'catDesc.tool': 'Tool execution results',
      'catDesc.other': 'Other content',
      'cat.tools': 'Tool schemas',
      'engine.title': 'Compression engine',
      'engine.auto.title': 'Auto (recommended)',
      'engine.auto.desc': 'Hands compaction to billion-context when detected; otherwise this plugin compacts.',
      'engine.plugin.title': 'This plugin only',
      'engine.plugin.desc': 'Always compacts with this plugin; running alongside billion-context may conflict.',
      'engine.off.title': 'Disable compaction',
      'engine.off.desc': 'This plugin never compacts; it only shows capacity and usage.',
      'engine.badge.plugin': 'This plugin',
      'engine.badge.bili': 'billion-context',
      'engine.badge.off': 'Disabled',
      'engine.banner.plugin': 'Current compaction engine: this plugin.',
      'engine.banner.bili': 'Compaction is handled by billion-context; this plugin does not compact. The statistics below come from billion-context.',
      'engine.banner.off': 'Compaction is disabled: this plugin will neither compact automatically nor manually.',
      'engine.banner.biliUnavailable': 'No running billion-context proxy detected ({error}); statistics are unavailable for now.',
      'engine.openBili': 'Open bili console',
      'bili.title': 'billion-context compaction statistics',
      'bili.hint': 'Source: billion-context {version}',
      'bili.unavailable': 'No data available: billion-context is not enabled or its proxy is not running.',
      'bili.openConsole': 'Open console',
      'bili.kpi.sessions': 'Sessions',
      'bili.kpi.blocks': 'Collapsed blocks',
      'bili.kpi.context': 'Current context tokens',
      'bili.kpi.cacheHit': 'Cache hit rate',
      'bili.col.session': 'Session',
      'bili.col.blocks': 'Blocks',
      'bili.col.context': 'Context tokens',
      'bili.col.input': 'Input tokens',
      'bili.col.cached': 'Cached tokens',
      'bili.col.output': 'Output tokens',
      'bili.col.hit': 'Hit rate',
      'bili.col.restores': 'Restores',
      'bili.col.lastSeen': 'Last seen',
      'bili.matched': 'Current session',
      'bili.cacheReport': 'Collapse economy detail (cache report)',
      'session.delegatedHint': 'Compaction is performed by billion-context; manual compaction from this plugin is disabled.',
      'session.disabledHint': 'Compaction is disabled; this plugin will not compact the context.',
      'records.biliNote': 'These are historical records from this plugin; no new records are added while billion-context is in charge.',
    }

    const ZH = {
      'panel.title': '上下文管理',
      'panel.subtitle': '上下文容量与压缩策略 · 全局 / 按提供商·模型 / 按会话',
      'settings.section.title': '上下文与压缩',
      'tab.defaults': '全局默认',
      'tab.models': '按提供商/模型',
      'tab.records': '压缩记录',
      'tab.session': '上下文',
      'tab.session.hint': '仅管理当前会话：容量、阈值、会话保护范围与压缩策略。',
      'common.save': '保存',
      'common.saved': '已保存',
      'common.saving': '保存中…',
      'common.reset': '使用默认值',
      'common.clear': '清除覆盖',
      'common.refresh': '刷新',
      'common.cancel': '取消',
      'common.close': '关闭',
      'common.loading': '加载中…',
      'common.empty': '暂无数据',
      'common.unknown': '未知',
      'common.tokens': 'Token',
      'common.none': '未设置',
      'common.inherited': '继承',
      'field.capacity': '自定义上下文容量',
      'field.capacity.hint': '用于下列所有百分比的生效窗口；留空则跟随当前模型窗口。',
      'field.maxCapacity': '模型支持的最大值',
      'field.maxCapacity.hint': '容量的上限，任何时候都不得高于模型支持的最大值。',
      'field.threshold': '压缩阈值',
      'field.threshold.hint': '上下文使用量达到容量的该比例时自动触发压缩。',
      'field.target': '目标压缩阈值',
      'field.target.hint': '压缩后希望降到的使用量比例，必须低于压缩阈值。',
      'field.protect': '会话保护范围',
      'field.protect.hint': '按容量的比例保留最近的对话原文，必须低于目标压缩阈值。',
      'field.strategy': '压缩策略',
      'field.strategy.summarize': '模型总结',
      'field.strategy.prune-first': '先裁剪工具输出再总结',
      'field.strategy.truncate': '不调用模型直接截断',
      'field.model': '压缩使用的模型',
      'field.model.current': '跟随当前模型',
      'field.model.main': '使用主模型',
      'field.model.fixed': '指定模型',
      'field.model.provider': '提供商',
      'field.model.model': '模型',
      'field.auto': '自动压缩',
      'field.auto.hint': '关闭后仍可手动压缩，但不会自动触发。',
      'scope.global': '全局默认',
      'scope.model': '提供商/模型覆盖',
      'scope.session': '会话覆盖',
      'source.session': '会话覆盖',
      'source.model': '提供商/模型覆盖',
      'source.global': '全局默认',
      'defaults.title': '全局默认配置',
      'defaults.desc': '当会话没有提供商/模型覆盖或会话覆盖时，使用这里的阈值、策略与压缩模型。',
      'models.title': '按提供商/模型单独设置',
      'models.desc': '每张模型卡片编辑该提供商与模型组合下所有会话使用的覆盖配置。',
      'models.search': '筛选提供商或模型…',
      'models.empty': '当前没有已注册的提供商路由。',
      'models.declared': '声明窗口',
      'models.override': '覆盖',
      'models.select': '编辑该路由',
      'records.title': '压缩记录',
      'records.desc': '本配置执行过的全部压缩，最新在前。',
      'records.total': '共 {n} 次压缩',
      'records.freed': '释放 {n} Token',
      'chart.beforeAfter': '每次压缩的前后对比',
      'chart.breakdown': '被压缩内容的类型',
      'chart.strategies': '策略分布',
      'chart.models': '生成总结使用的模型',
      'chart.freed': '释放的 Token',
      'chart.before': '压缩前',
      'chart.after': '压缩后',
      'chart.noRecords': '还没有压缩记录。自动或手动压缩发生后会显示在这里。',
      'cat.system': '系统提示词',
      'cat.inject': '注入上下文',
      'cat.user': '用户消息',
      'cat.assistant': '助手消息',
      'cat.tool': '工具结果',
      'cat.other': '其他',
      'table.at': '时间',
      'table.session': '会话',
      'table.trigger': '触发方式',
      'table.strategy': '策略',
      'table.model': '总结模型',
      'table.before': '压缩前',
      'table.after': '压缩后',
      'table.freed': '释放',
      'table.nodes': '节点数',
      'trigger.auto': '自动',
      'trigger.manual': '手动',
      'trigger.capacity-shrink': '容量收缩',
      'session.title': '上下文窗口',
      'session.desc': '此处的修改仅对当前会话生效。',
      'session.used': '已用 {used} / {capacity}（{percent}%）',
      'session.threshold': '阈值 {value}',
      'session.target': '目标 {value}',
      'session.protect': '保护 {value}',
      'session.source': '生效来源：{source}',
      'session.real': '模型窗口 {value}',
      'session.apply': '应用到当前会话',
      'session.compact': '立即压缩',
      'session.compacting': '压缩中…',
      'session.reset': '重置为默认',
      'session.notRouted': '该会话还没有发起过模型请求，请先发送一条消息。',
      'session.noteExpand': '对已存在的会话，扩大容量无法推迟内置触发；自定义阈值会完整作用于安装后新建的会话。',
      'shrink.title': '收缩需要先压缩',
      'shrink.body': '当前使用量（{used} Token）高于目标容量（{capacity} Token）。确认后将按所选策略执行一次压缩，再应用较小的容量。',
      'shrink.confirm': '压缩并应用',
      'compaction.done': '已压缩：{before} → {after} Token（释放 {freed}）。',
      'compaction.none': '没有可安全压缩的内容。',
      'marker.used': '已用',
      'marker.threshold': '触发线',
      'marker.target': '目标线',
      'error.load': '无法读取上下文管理数据',
      'error.save': '无法保存',
      'capacity.title': '自定义上下文容量',
      'capacity.default': '默认：{value}（模型支持最大值）',
      'capacity.recommended': '推荐值',
      'capacity.useDefault': '使用默认值',
      'capacity.maxField': '模型支持的最大值',
      'capacity.maxHint': '容量的上限；留空则使用该路由声明的模型窗口（{value}）。',
      'defaults.capacityNotePrefix': '上下文容量无全局设置，请在「',
      'defaults.capacityNoteSuffix': '」中单独为模型配置。',
      'capacity.priorityNote': '优先级：会话容量 → 提供商/模型容量 → 模型支持最大值。',
      'models.cardDeclared': '声明 {value}',
      'models.cardMax': '上限 {value}',
      'models.cardCapacity': '容量 {value}',
      'models.cardDefault': '默认',
      'models.cardOverride': '已覆盖',
      'models.editTitle': '编辑 {name}',
      'models.pickHint': '选择一张模型卡片以编辑其覆盖配置。',
      'strategy.hint': '压缩如何缩减上下文窗口，以及它的代价。',
      'strategy.summarize.title': '模型总结',
      'strategy.summarize.desc': '由压缩模型生成结构化检查点替换较早对话。保留信息最完整，需调用一次模型。',
      'strategy.prune-first.title': '先裁剪后总结',
      'strategy.prune-first.desc': '先裁剪超大工具输出，仍高于触发线时再总结。更省 Token。',
      'strategy.prune-only.title': '仅裁剪',
      'strategy.prune-only.desc': '只裁剪超大工具输出，不调用模型；裁剪后仍不够时停止并提示。',
      'strategy.truncate.title': '确定性截断',
      'strategy.truncate.desc': '不调用模型，用简短说明替换较早对话。最省成本，细节会丢失。',
      'ghost.target': '目标线',
      'manual.gate.blocked': '不可用：当前用量 {used} 低于目标线 {target}。',
      'manual.gate.hint': '已用 {used} · 触发线 {threshold} · 目标线 {target}',
      'manual.confirmTitle': '在触发线以下压缩？',
      'manual.confirmBody': '上下文使用量（{used}）未达到触发线（{threshold}），但已达到目标线（{target}）。继续压缩可能低于目标值，是否继续？',
      'reset.button': '重置为默认',
      'reset.confirmTitle': '将该会话重置为默认？',
      'reset.confirmBody': '将清除本会话的覆盖，恢复为模型默认容量（{capacity}）。不会删除任何会话数据。是否继续？',
      'reset.compactionTitle': '重置需要一次压缩',
      'reset.compactionBody': '默认容量（{capacity}）低于当前用量（{used}）。确认后将清除覆盖并按当前策略执行一次压缩。是否继续？',
      'reset.done': '已清除会话覆盖，默认容量 {capacity}。',
      'common.confirm': '确认',
      'common.continue': '继续',
      'session.defaultCapacity': '默认 {value}',
      'session.lines': '触发线 {threshold} · 目标线 {target}',
      'field.strategy.prune-only': '仅裁剪',
      'trigger.reset-default': '重置为默认',
      'range.label': '时间范围',
      'range.today': '今天',
      'range.7d': '近 7 天',
      'range.30d': '近 30 天',
      'range.all': '全部',
      'range.tenPercent': '10%',
      'range.maximum': '最大值',
      'capacity.slider': '容量拖动条',
      'kpi.sessionsCompactions': '会话数 · 压缩次数',
      'kpi.totalFreed': '总计释放的上下文数量',
      'kpi.avgFreed': '平均每个会话释放的上下文数量',
      'chart.breakdownHint': '被替换内容按类型统计的 Token 占比',
      'chart.strategiesHint': '压缩次数 · 释放 Token',
      'chart.modelsHint': '各总结模型消耗的压缩 Token',
      'chart.compressedTotal': '被压缩',
      'chart.legacyNoUsage': '无 token 记录',
      'table.summaryTokens': '总结 tokens',
      'cat.skill': '技能注入',
      'catDesc.system': '系统提示词与固定前缀',
      'catDesc.user': '用户发送的消息',
      'catDesc.inject': '插件、工具或系统提醒注入的上下文',
      'catDesc.skill': '技能加载注入的内容',
      'catDesc.assistant': '助手回复与工具调用',
      'catDesc.tool': '工具执行结果',
      'catDesc.other': '其他内容',
      'cat.tools': '工具定义',
      'engine.title': '压缩执行引擎',
      'engine.auto.title': '自动（推荐）',
      'engine.auto.desc': '检测到 billion-context 时自动让位，否则由本插件执行压缩。',
      'engine.plugin.title': '仅本插件',
      'engine.plugin.desc': '始终由本插件执行压缩；与 billion-context 同时启用可能冲突。',
      'engine.off.title': '停用压缩',
      'engine.off.desc': '本插件不执行任何压缩，仅展示容量与用量。',
      'engine.badge.plugin': '本插件',
      'engine.badge.bili': 'billion-context',
      'engine.badge.off': '已停用',
      'engine.banner.plugin': '当前压缩执行引擎：本插件。',
      'engine.banner.bili': '当前压缩由 billion-context 接管；本插件不执行压缩，以下统计来自 billion-context。',
      'engine.banner.off': '压缩已停用：本插件不会自动或手动压缩上下文。',
      'engine.banner.biliUnavailable': '未检测到运行中的 billion-context 代理（{error}）；统计数据暂不可用。',
      'engine.openBili': '打开 bili 控制台',
      'bili.title': 'billion-context 压缩统计',
      'bili.hint': '数据来源：billion-context {version}',
      'bili.unavailable': '暂无可用数据：billion-context 未启用或代理未运行。',
      'bili.openConsole': '打开控制台',
      'bili.kpi.sessions': '会话数',
      'bili.kpi.blocks': '折叠块总数',
      'bili.kpi.context': '当前上下文 Token',
      'bili.kpi.cacheHit': '缓存命中率',
      'bili.col.session': '会话',
      'bili.col.blocks': '折叠块',
      'bili.col.context': '上下文 Token',
      'bili.col.input': '输入 Token',
      'bili.col.cached': '缓存 Token',
      'bili.col.output': '输出 Token',
      'bili.col.hit': '命中率',
      'bili.col.restores': '恢复次数',
      'bili.col.lastSeen': '最近活动',
      'bili.matched': '当前会话',
      'bili.cacheReport': '折叠经济明细（cache report）',
      'session.delegatedHint': '压缩由 billion-context 执行，本插件的手动压缩已停用。',
      'session.disabledHint': '压缩已停用，本插件不会压缩上下文。',
      'records.biliNote': '以下为本插件历史记录；billion-context 接管期间不会新增记录。',
    }

    const CSS = `
.dcm-root { box-sizing: border-box; height: 100%; overflow: auto; padding: 16px 18px 40px; color: var(--dsw-alias-label-primary); background: #F2F2F2; font-size: 14px; line-height: 1.55; }
body[data-ds-dark-theme] .dcm-root { background: var(--dsw-alias-bg-layer-2); }
.dcm-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
.dcm-title { margin: 0; font-size: 18px; font-weight: 600; letter-spacing: .1px; }
.dcm-sub { margin: 5px 0 0; color: var(--dsw-alias-label-secondary); font-size: 14px; max-width: 820px; }
.dcm-subhead { margin: 0; font-size: 15px; font-weight: 600; }
.dcm-sectionhead { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
.dcm-sectionhead-icon { display: inline-flex; align-items: center; justify-content: center; width: 30px; height: 30px; border-radius: 8px; color: var(--dsw-alias-label-secondary); background: color-mix(in srgb, var(--dsw-alias-label-secondary) 10%, transparent); flex: none; }
.dcm-sectionhead-text { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.dcm-sectionhead-hint { font-size: 14px; color: var(--dsw-alias-label-secondary); }
.dcm-muted { color: var(--dsw-alias-label-secondary); }
.dcm-dim { color: var(--dsw-alias-state-idle-primary); }
.dcm-tabs { display: flex; gap: 4px; padding: 3px; border-radius: 10px; background: color-mix(in srgb, var(--dsw-alias-label-secondary) 8%, transparent); width: fit-content; margin-bottom: 12px; }
.dcm-tab { display: inline-flex; align-items: center; gap: 7px; border: 0; background: transparent; color: var(--dsw-alias-label-secondary); padding: 6px 14px; border-radius: 8px; font-size: 14px; cursor: pointer; }
.dcm-tab-on { background: var(--dsw-alias-bg-layer-1); color: var(--dsw-alias-label-primary); box-shadow: 0 1px 2px rgba(0,0,0,.10); }
.dcm-card { background: var(--dsw-alias-bg-layer-1); border: 0.5px solid var(--dsw-alias-border-l1); border-radius: 12px; padding: 16px 18px; box-shadow: 0 1px 2px rgba(0,0,0,.06), 0 2px 10px rgba(0,0,0,.05); }
.dcm-card-flat { box-shadow: none; }
.dcm-grid { display: grid; grid-template-columns: minmax(0, 1.02fr) minmax(0, 1fr); gap: 10px; align-items: start; }
.dcm-stack { display: flex; flex-direction: column; gap: 10px; }
.dcm-row { display: flex; align-items: center; gap: 9px; flex-wrap: wrap; }
.dcm-between { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.dcm-field { display: flex; flex-direction: column; gap: 6px; margin-bottom: 14px; }
.dcm-field:last-child { margin-bottom: 0; }
.dcm-label { display: inline-flex; align-items: center; gap: 6px; font-size: 14px; font-weight: 600; }
.dcm-hint { font-size: 14px; color: var(--dsw-alias-label-secondary); }
.dcm-note { border: 0.5px solid var(--dsw-alias-border-l1); background: color-mix(in srgb, var(--dsw-alias-label-secondary) 6%, transparent); border-radius: 9px; padding: 9px 12px; font-size: 14px; color: var(--dsw-alias-label-secondary); }
.dcm-note-ref { display: inline-flex; align-items: center; gap: 4px; vertical-align: -2px; color: var(--dsw-alias-label-primary); font-weight: 600; }
.dcm-note-link { border: 0; background: transparent; padding: 0; font: inherit; cursor: pointer; color: var(--dsw-alias-brand-primary); }
.dcm-note-link:hover { text-decoration: underline; }
.dcm-input, .dcm-select { box-sizing: border-box; width: 100%; height: 34px; padding: 0 10px; border-radius: 8px; border: 0.5px solid var(--dsw-alias-border-l2); background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-primary); font-size: 14px; outline: none; }
.dcm-input:focus, .dcm-select:focus { border-color: var(--dsw-focus-ring-color, var(--dsw-alias-state-idle-primary)); box-shadow: 0 0 0 var(--dsw-focus-ring-width, 2px) color-mix(in srgb, var(--dsw-focus-ring-color, #4176e6) 22%, transparent); }
.dcm-input-sm { width: 132px; height: 32px; }
.dcm-inline { display: flex; align-items: center; gap: 9px; flex-wrap: wrap; }
.dcm-chips { display: flex; gap: 7px; flex-wrap: wrap; align-items: center; }
.dcm-chip { border: 0.5px solid var(--dsw-alias-border-l2); background: var(--dsw-alias-bg-layer-1); color: var(--dsw-alias-label-secondary); border-radius: 999px; padding: 3px 11px; font-size: 14px; cursor: pointer; }
.dcm-chip:hover { color: var(--dsw-alias-label-primary); }
.dcm-chip-on { color: var(--dsw-alias-label-primary); border-color: color-mix(in srgb, var(--dsw-alias-brand-primary) 45%, transparent); background: color-mix(in srgb, var(--dsw-alias-brand-primary) 8%, var(--dsw-alias-bg-layer-1)); }
.dcm-btn { display: inline-flex; align-items: center; gap: 7px; height: 34px; padding: 0 15px; border-radius: 8px; font-size: 14px; cursor: pointer; border: 0.5px solid var(--dsw-alias-border-l2); background: var(--dsw-alias-bg-layer-1); color: var(--dsw-alias-label-primary); }
.dcm-btn:hover { background: var(--dsw-alias-bg-layer-2); }
.dcm-btn-primary { background: var(--dsw-alias-brand-primary); color: var(--dsw-alias-bg-base); border-color: transparent; }
.dcm-btn-primary:hover { filter: brightness(1.08); background: var(--dsw-alias-brand-primary); }
.dcm-btn-danger { color: var(--dsw-alias-state-error-primary); }
.dcm-btn:disabled, .dcm-btn[aria-disabled="true"] { opacity: .5; cursor: not-allowed; }
.dcm-badge { display: inline-flex; align-items: center; height: 22px; padding: 0 9px; border-radius: 999px; font-size: 14px; border: 0.5px solid var(--dsw-alias-border-l2); color: var(--dsw-alias-label-secondary); background: var(--dsw-alias-bg-layer-2); white-space: nowrap; }
.dcm-badge-warn { color: var(--dsw-alias-state-warn-primary); border-color: color-mix(in srgb, var(--dsw-alias-state-warn-primary) 45%, transparent); }
.dcm-badge-ok { color: var(--dsw-alias-state-success-primary); border-color: color-mix(in srgb, var(--dsw-alias-state-success-primary) 45%, transparent); }
.dcm-split { position: relative; height: 24px; border-radius: 7px; background: var(--dsw-alias-bg-layer-2); overflow: hidden; border: 0.5px solid var(--dsw-alias-border-l2); }
.dcm-split-used { position: absolute; left: 0; top: 0; bottom: 0; background: color-mix(in srgb, var(--dsw-alias-state-success-primary) 55%, transparent); }
.dcm-split-warn { position: absolute; left: 0; top: 0; bottom: 0; background: color-mix(in srgb, var(--dsw-alias-state-warn-primary) 60%, transparent); }
.dcm-split-danger { position: absolute; left: 0; top: 0; bottom: 0; background: color-mix(in srgb, var(--dsw-alias-state-error-primary) 60%, transparent); }
.dcm-split-protect { position: absolute; top: 0; bottom: 0; background: repeating-linear-gradient(45deg, color-mix(in srgb, var(--dsw-alias-state-idle-primary) 24%, transparent) 0 4px, transparent 4px 8px); }
.dcm-marker { position: absolute; top: -2px; bottom: -2px; width: 2px; border-radius: 1px; }
.dcm-legend { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 10px; font-size: 14px; color: var(--dsw-alias-label-secondary); }
.dcm-legend i { display: inline-block; width: 10px; height: 10px; border-radius: 2px; margin-right: 5px; vertical-align: -1px; }
.dcm-kpis { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
.dcm-kpi { background: var(--dsw-alias-bg-layer-1); border: 0.5px solid var(--dsw-alias-border-l1); border-radius: 10px; padding: 12px 14px; box-shadow: 0 1px 2px rgba(0,0,0,.05); }
.dcm-kpi-v { font-size: 21px; font-weight: 600; font-variant-numeric: tabular-nums; line-height: 1.3; }
.dcm-kpi-l { font-size: 14px; color: var(--dsw-alias-label-secondary); margin-top: 3px; }
.dcm-kpi-s { font-size: 14px; color: var(--dsw-alias-label-secondary); margin-top: 2px; font-variant-numeric: tabular-nums; }
.dcm-table { width: 100%; border-collapse: collapse; font-size: 14px; }
.dcm-table th { text-align: left; font-weight: 600; color: var(--dsw-alias-label-secondary); font-size: 14px; padding: 8px 10px; border-bottom: 0.5px solid var(--dsw-alias-border-l2); white-space: nowrap; }
.dcm-table td { padding: 8px 10px; border-bottom: 0.5px solid var(--dsw-alias-border-l1); white-space: nowrap; font-variant-numeric: tabular-nums; }
.dcm-table tr:last-child td { border-bottom: 0; }
.dcm-scroll { overflow: auto; max-height: 380px; }
.dcm-range { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 10px; }
.dcm-range-label { display: inline-flex; align-items: center; gap: 6px; font-size: 14px; color: var(--dsw-alias-label-secondary); }
.dcm-range-chip { border: 0.5px solid var(--dsw-alias-border-l2); background: var(--dsw-alias-bg-layer-1); color: var(--dsw-alias-label-secondary); border-radius: 999px; padding: 4px 14px; font-size: 14px; cursor: pointer; }
.dcm-range-chip-on { color: var(--dsw-alias-label-primary); border-color: color-mix(in srgb, var(--dsw-alias-brand-primary) 45%, transparent); background: color-mix(in srgb, var(--dsw-alias-brand-primary) 8%, var(--dsw-alias-bg-layer-1)); }
.dcm-two { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; align-items: start; }
.dcm-modelgrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 10px; }
.dcm-modelcard { text-align: left; border: 0.5px solid var(--dsw-alias-border-l1); background: var(--dsw-alias-bg-layer-1); border-radius: 10px; padding: 11px 12px; cursor: pointer; box-shadow: 0 1px 2px rgba(0,0,0,.05); display: flex; flex-direction: column; gap: 5px; min-width: 0; }
.dcm-modelcard:hover { border-color: var(--dsw-alias-border-l2); box-shadow: 0 2px 8px rgba(0,0,0,.09); }
.dcm-modelcard-on { border-color: color-mix(in srgb, var(--dsw-alias-brand-primary) 50%, transparent); box-shadow: 0 0 0 1px color-mix(in srgb, var(--dsw-alias-brand-primary) 35%, transparent), 0 2px 8px rgba(0,0,0,.09); }
.dcm-modelcard-top { display: flex; align-items: center; justify-content: space-between; gap: 6px; min-width: 0; }
.dcm-modelcard-name { font-size: 14px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dcm-modelcard-meta { font-size: 14px; color: var(--dsw-alias-label-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dcm-strategies { display: flex; flex-direction: column; gap: 7px; }
.dcm-strategycard { display: flex; align-items: flex-start; gap: 9px; border: 0.5px solid var(--dsw-alias-border-l2); background: var(--dsw-alias-bg-layer-1); border-radius: 9px; padding: 9px 11px; cursor: pointer; text-align: left; }
.dcm-strategycard:hover { background: var(--dsw-alias-bg-layer-2); }
.dcm-strategycard-on { border-color: color-mix(in srgb, var(--dsw-alias-brand-primary) 50%, transparent); background: color-mix(in srgb, var(--dsw-alias-brand-primary) 6%, var(--dsw-alias-bg-layer-1)); }
.dcm-strategyradio { width: 15px; height: 15px; border-radius: 50%; border: 0.5px solid var(--dsw-alias-border-l2); margin-top: 3px; flex: none; background: var(--dsw-alias-bg-layer-1); }
.dcm-strategyradio-on { border-color: var(--dsw-alias-brand-primary); box-shadow: inset 0 0 0 4px var(--dsw-alias-bg-layer-1); background: var(--dsw-alias-brand-primary); }
.dcm-strategy-title { font-size: 15px; font-weight: 600; }
.dcm-strategy-desc { font-size: 14px; color: var(--dsw-alias-label-secondary); margin-top: 2px; }
.dcm-slider-wrap { display: flex; flex-direction: column; gap: 6px; padding-top: 2px; }
.dcm-slider { width: 100%; accent-color: var(--dsw-alias-brand-primary); height: 24px; margin: 0; }
.dcm-slider-scale { display: flex; justify-content: space-between; font-size: 14px; color: var(--dsw-alias-label-secondary); }
.dcm-slider-value { font-size: 14px; font-variant-numeric: tabular-nums; color: var(--dsw-alias-label-primary); }
.dcm-empty { color: var(--dsw-alias-label-secondary); font-size: 14px; padding: 20px 0; text-align: center; }
.dcm-error { color: var(--dsw-alias-state-error-primary); font-size: 14px; padding: 6px 0; }
.dcm-skeleton { height: 14px; border-radius: 6px; background: var(--dsw-alias-bg-layer-2); animation: dcm-pulse 1.4s ease-in-out infinite; }
@keyframes dcm-pulse { 0%,100% { opacity: .55 } 50% { opacity: 1 } }
.dcm-chart { width: 100%; display: block; }
.dcm-chart text { font-size: 14px; fill: var(--dsw-alias-label-secondary); }
.dcm-donut-wrap { display: flex; flex-wrap: nowrap; align-items: center; gap: 22px; }
.dcm-donut-left { flex: 0 0 auto; }
.dcm-donut { width: 190px; height: 190px; display: block; }
.dcm-donut-legend { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; gap: 10px; }
.dcm-donut-row { display: flex; align-items: flex-start; gap: 10px; }
.dcm-donut-swatch { width: 18px; height: 18px; border-radius: 4px; flex: none; margin-top: 2px; border: 0.5px solid rgba(0,0,0,.08); }
.dcm-donut-text { display: flex; flex-direction: column; gap: 1px; min-width: 0; flex: 1 1 auto; }
.dcm-donut-name { color: var(--dsw-alias-label-primary); font-size: 14px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dcm-donut-desc { color: var(--dsw-alias-label-secondary); font-size: 14px; }
.dcm-donut-meta { color: var(--dsw-alias-label-secondary); font-size: 14px; font-variant-numeric: tabular-nums; white-space: nowrap; flex: none; }
@media (max-width: 640px) { .dcm-donut-wrap { flex-wrap: wrap; } }
.dcm-bars { display: flex; flex-direction: column; gap: 9px; }
.dcm-bar-row { display: flex; flex-direction: column; gap: 4px; }
.dcm-bar-head { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; font-size: 14px; }
.dcm-bar-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dcm-bar-val { color: var(--dsw-alias-label-secondary); font-variant-numeric: tabular-nums; flex: none; }
.dcm-bar-track { height: 8px; border-radius: 4px; background: var(--dsw-alias-bg-layer-2); overflow: hidden; }
.dcm-bar-fill { height: 100%; border-radius: 4px; background: color-mix(in srgb, var(--dsw-alias-state-success-primary) 75%, transparent); }
.dcm-threshold-strip { position: relative; height: 8px; border-radius: 4px; background: var(--dsw-alias-bg-layer-2); overflow: hidden; }
.dcm-threshold-zone { position: absolute; top: 0; bottom: 0; }
.dcm-modal-overlay { position: fixed; inset: 0; z-index: 1200; background: rgba(10, 14, 20, .42); display: flex; align-items: center; justify-content: center; padding: 24px; }
.dcm-modal { width: min(480px, 92vw); background: var(--dsw-alias-bg-layer-1); color: var(--dsw-alias-label-primary); border: 0.5px solid var(--dsw-alias-border-l2); border-radius: 14px; padding: 20px; box-shadow: 0 12px 40px rgba(0,0,0,.28); }
.dcm-modal-title { font-size: 16px; font-weight: 600; margin-bottom: 9px; display: flex; align-items: center; gap: 9px; }
.dcm-modal-body { font-size: 14px; color: var(--dsw-alias-label-secondary); line-height: 1.65; }
.dcm-modal-actions { display: flex; justify-content: flex-end; gap: 9px; margin-top: 18px; }
@media (max-width: 1080px) { .dcm-grid { grid-template-columns: minmax(0, 1fr); } .dcm-kpis { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
@media (max-width: 760px) { .dcm-kpis { grid-template-columns: minmax(0, 1fr); } .dcm-two { grid-template-columns: minmax(0, 1fr); } }
.dcm-engine-banner { display: flex; align-items: center; gap: 9px; flex-wrap: wrap; border: 0.5px solid var(--dsw-alias-border-l1); background: color-mix(in srgb, var(--dsw-alias-label-secondary) 6%, transparent); border-radius: 9px; padding: 9px 12px; margin-bottom: 12px; }
.dcm-engine-banner .dcm-badge { flex: none; }
.dcm-engine-banner a.dcm-btn, .dcm-note a.dcm-btn, .dcm-row a.dcm-btn { text-decoration: none; }
.dcm-kpis-4 { grid-template-columns: repeat(4, minmax(0, 1fr)); }
.dcm-details { margin-top: 4px; }
.dcm-details summary { cursor: pointer; font-size: 14px; font-weight: 600; }
.dcm-pre { max-height: 260px; overflow: auto; font-size: 14px; white-space: pre-wrap; background: var(--dsw-alias-bg-layer-2); border: 0.5px solid var(--dsw-alias-border-l1); border-radius: 8px; padding: 10px 12px; margin: 8px 0 0; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; line-height: 1.5; }
@media (max-width: 1080px) { .dcm-kpis-4 { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 760px) { .dcm-kpis-4 { grid-template-columns: minmax(0, 1fr); } }
`

    /* ── helpers ─────────────────────────────────────────────────────────── */

    const api = async (route, body = {}, signal) => {
      const response = await fetch(`/api/dsh-context-manager/${route}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
        ...signal === undefined ? {} : { signal },
      })
      let payload
      try {
        payload = await response.json()
      } catch {
        throw new Error(`HTTP ${response.status}`)
      }
      if (payload === null || typeof payload !== 'object' || payload.ok !== true) {
        throw new Error(payload?.error?.message ?? `HTTP ${response.status}`)
      }
      return payload.value
    }

    const fmtTokens = (value) => {
      if (typeof value !== 'number' || !Number.isFinite(value)) return '—'
      const abs = Math.abs(value)
      if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(abs >= 10_000_000 ? 1 : 2)}M`
      if (abs >= 1_000) return `${Math.round(value / 1_000)}k`
      return String(Math.round(value))
    }
    const fmtPercent = (value) => (typeof value === 'number' && Number.isFinite(value) ? `${Math.round(value * 10) / 10}%` : '—')
    const fmtTime = (value) => {
      if (typeof value !== 'number' || !Number.isFinite(value)) return '—'
      const date = new Date(value)
      const pad = (part) => String(part).padStart(2, '0')
      return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
    }
    const shortId = (value) => (typeof value === 'string' && value.length > 12 ? `${value.slice(0, 8)}…` : String(value ?? ''))

    function useApi(route, body, watch = '') {
      const [state, setState] = React.useState({ loading: true, value: undefined, error: undefined })
      const bodyKey = JSON.stringify(body ?? {})
      const reload = React.useCallback(() => {
        const controller = new AbortController()
        setState((previous) => ({ ...previous, loading: true }))
        api(route, body ?? {}, controller.signal)
          .then((value) => setState({ loading: false, value, error: undefined }))
          .catch((error) => {
            if (controller.signal.aborted) return
            setState((previous) => ({ loading: false, value: previous.value, error }))
          })
        return () => controller.abort()
      }, [route, bodyKey, watch])
      React.useEffect(() => reload(), [reload])
      React.useEffect(() => {
        const timer = window.setInterval(() => reload(), 5000)
        return () => window.clearInterval(timer)
      }, [reload])
      return [state.value, state.error, state.loading, reload]
    }

    /* ── primitives ──────────────────────────────────────────────────────── */

    function Field(props) {
      return h(
        'div',
        { className: 'dcm-field' },
        h('div', { className: 'dcm-between' }, h('span', { className: 'dcm-label' }, props.label), props.trailing ?? null),
        props.control,
        props.hint === undefined ? null : h('div', { className: 'dcm-hint' }, props.hint),
      )
    }

    function NumberInput(props) {
      return h('input', {
        className: `dcm-input${props.small === true ? ' dcm-input-sm' : ''}`,
        type: 'number',
        min: props.min,
        max: props.max,
        step: props.step ?? 1,
        value: props.value === null || props.value === undefined ? '' : String(props.value),
        placeholder: props.placeholder ?? '',
        onChange: (event) => {
          const raw = event.target.value
          props.onChange(raw === '' ? null : Number(raw))
        },
        'aria-label': props.label,
      })
    }

    function PercentSlider(props) {
      return h(
        'div',
        { className: 'dcm-inline' },
        h('input', {
          type: 'range',
          min: props.min ?? 5,
          max: props.max ?? 95,
          step: 1,
          value: props.value ?? 50,
          style: { flex: '1 1 auto', accentColor: 'var(--dsw-alias-state-success-primary)' },
          onChange: (event) => props.onChange(Number(event.target.value)),
          'aria-label': props.label,
        }),
        h(NumberInput, {
          small: true,
          label: props.label,
          min: props.min,
          max: props.max,
          value: props.value,
          onChange: props.onChange,
        }),
        h('span', { className: 'dcm-muted' }, '%'),
      )
    }

    function Segmented(props) {
      return h(
        'div',
        { className: 'dcm-chips', role: 'group', 'aria-label': props.label },
        props.options.map((option) =>
          h(
            'button',
            {
              key: option.value,
              type: 'button',
              className: `dcm-chip${props.value === option.value ? ' dcm-chip-on' : ''}`,
              onClick: () => props.onChange(option.value),
              title: option.hint,
            },
            option.label,
          ),
        ),
      )
    }

    function Select(props) {
      return h(
        'select',
        {
          className: 'dcm-select',
          value: props.value ?? '',
          onChange: (event) => props.onChange(event.target.value),
          'aria-label': props.label,
        },
        ...(props.options ?? []).map((option) =>
          h('option', { key: option.value, value: option.value }, option.label),
        ),
      )
    }

    function Toggle(props) {
      return h(
        'button',
        {
          type: 'button',
          role: 'switch',
          'aria-checked': props.value === true,
          'aria-label': props.label,
          onClick: () => props.onChange(props.value !== true),
          style: {
            width: '36px',
            height: '20px',
            borderRadius: '999px',
            border: '0.5px solid var(--dsw-alias-border-l2)',
            background: props.value === true ? 'var(--dsw-alias-state-success-primary)' : 'var(--dsw-alias-bg-layer-2)',
            position: 'relative',
            cursor: 'pointer',
            padding: 0,
          },
        },
        h('span', {
          style: {
            position: 'absolute',
            top: '2px',
            left: props.value === true ? '18px' : '2px',
            width: '14px',
            height: '14px',
            borderRadius: '50%',
            background: props.value === true ? 'var(--dsw-alias-bg-base)' : 'var(--dsw-alias-label-secondary)',
            transition: 'left 120ms ease',
          },
        }),
      )
    }

    function Badge(props) {
      return h('span', { className: `dcm-badge${props.tone === undefined ? '' : ` dcm-badge-${props.tone}`}` }, props.children)
    }

    function Loading() {
      return h(
        'div',
        { className: 'dcm-stack', style: { padding: '10px 0' } },
        h('div', { className: 'dcm-skeleton', style: { width: '42%' } }),
        h('div', { className: 'dcm-skeleton', style: { width: '86%' } }),
        h('div', { className: 'dcm-skeleton', style: { width: '70%' } }),
      )
    }

    function ErrorBox(props) {
      return h('div', { className: 'dcm-error', role: 'alert' }, `${props.prefix ?? ''}${props.error instanceof Error ? props.error.message : String(props.error)}`)
    }

    function Empty(props) {
      return h('div', { className: 'dcm-empty' }, props.children)
    }

    /* ── charts ──────────────────────────────────────────────────────────── */

    function Legend(props) {
      return h(
        'div',
        { className: 'dcm-legend' },
        props.items.map((item) => h('span', { key: item.label }, h('i', { style: { background: item.color } }), item.label)),
      )
    }

    function BeforeAfterChart(props) {
      const records = (props.records ?? []).slice(0, 14).reverse()
      if (records.length === 0) return h(Empty, null, props.emptyLabel)
      const width = 720
      const height = 250
      const padLeft = 78
      const padBottom = 36
      const plotWidth = width - padLeft - 10
      const plotHeight = height - padBottom - 14
      const max = Math.max(1, ...records.map((record) => Math.max(record.tokensBefore ?? 0, record.tokensAfter ?? 0)))
      const slot = plotWidth / records.length
      const barWidth = Math.max(4, Math.min(18, slot / 3))
      const y = (value) => 14 + plotHeight - (value / max) * plotHeight
      const grid = [0, 0.25, 0.5, 0.75, 1].map((fraction) => {
        const value = Math.round(max * fraction)
        return h(
          'g',
          { key: `g${fraction}` },
          h('line', {
            x1: padLeft,
            x2: width - 10,
            y1: y(value),
            y2: y(value),
            stroke: 'var(--dsw-alias-border-l1)',
            strokeWidth: 0.5,
            strokeDasharray: fraction === 0 ? undefined : '3 4',
          }),
          h('text', { x: 6, y: y(value) + 5 }, fmtTokens(value)),
        )
      })
      const step = Math.max(1, Math.ceil(records.length / 6))
      const bars = records.flatMap((record, index) => {
        const center = padLeft + slot * index + slot / 2
        const beforeHeight = Math.max(1, ((record.tokensBefore ?? 0) / max) * plotHeight)
        const afterHeight = Math.max(1, ((record.tokensAfter ?? 0) / max) * plotHeight)
        return [
          h('rect', {
            key: `b${index}`,
            x: center - barWidth - 1,
            y: 14 + plotHeight - beforeHeight,
            width: barWidth,
            height: beforeHeight,
            rx: 1.5,
            fill: 'var(--dsw-alias-state-idle-primary)',
            opacity: 0.75,
          }),
          h('rect', {
            key: `a${index}`,
            x: center + 1,
            y: 14 + plotHeight - afterHeight,
            width: barWidth,
            height: afterHeight,
            rx: 1.5,
            fill: 'var(--dsw-alias-state-success-primary)',
            opacity: 0.9,
          }),
          index % step === 0
            ? h('text', { key: `t${index}`, x: center, y: height - 8, textAnchor: 'middle' }, fmtTime(record.at).slice(6))
            : null,
        ]
      })
      return h(
        'div',
        null,
        h('svg', { className: 'dcm-chart', viewBox: `0 0 ${width} ${height}`, role: 'img', 'aria-label': props.title }, grid, bars),
        h(Legend, {
          items: [
            { label: props.beforeLabel, color: 'var(--dsw-alias-state-idle-primary)' },
            { label: props.afterLabel, color: 'var(--dsw-alias-state-success-primary)' },
          ],
        }),
      )
    }

    const CATEGORY_ORDER = ['system', 'user', 'inject', 'skill', 'assistant', 'tool', 'other']
    const CATEGORY_COLORS = {
      system: 'oklch(58.5% .233 277.117)',
      user: 'oklch(72.3% .219 149.579)',
      inject: 'oklch(62.7% .265 303.9)',
      skill: 'oklch(70.5% .213 47.604)',
      assistant: 'oklch(62.3% .214 259.815)',
      tool: 'oklch(70.4% .14 182.503)',
      other: 'var(--dsw-alias-state-idle-primary)',
    }
    const RANGE_VALUES = ['today', '7d', '30d', 'all']

    function RangeSelector(props) {
      return h(
        'div',
        { className: 'dcm-range', role: 'group', 'aria-label': props.label },
        h('span', { className: 'dcm-range-label' }, h(Icon, { name: 'chart', size: 15 }), props.label),
        RANGE_VALUES.map((value) =>
          h(
            'button',
            {
              key: value,
              type: 'button',
              className: 'dcm-range-chip' + (props.value === value ? ' dcm-range-chip-on' : ''),
              'aria-pressed': props.value === value,
              onClick: () => props.onChange(value),
            },
            props.t('range.' + value),
          ),
        ),
      )
    }

    function DonutChart(props) {
      const totals = props.totals ?? {}
      const entries = CATEGORY_ORDER.filter((key) => (totals[key] ?? 0) > 0).map((key) => ({
        key,
        value: totals[key],
        color: CATEGORY_COLORS[key],
      }))
      const total = entries.reduce((sum, entry) => sum + entry.value, 0)
      if (total <= 0) return h(Empty, null, props.emptyLabel)
      const radius = 68
      const circumference = 2 * Math.PI * radius
      let offset = 0
      const segments = entries.map((entry) => {
        const fraction = entry.value / total
        const length = Math.max(0, fraction * circumference - 1.5)
        const segment = h('circle', {
          key: entry.key,
          cx: 100,
          cy: 100,
          r: radius,
          fill: 'none',
          stroke: entry.color,
          strokeWidth: 26,
          strokeDasharray: `${length} ${circumference - length}`,
          strokeDashoffset: -offset,
          transform: 'rotate(-90 100 100)',
        })
        offset += fraction * circumference
        return segment
      })
      return h(
        'div',
        { className: 'dcm-donut-wrap' },
        h(
          'div',
          { className: 'dcm-donut-left' },
          h(
            'svg',
            { className: 'dcm-donut', viewBox: '0 0 200 200', role: 'img', 'aria-label': props.title },
            h('circle', { cx: 100, cy: 100, r: radius, fill: 'none', stroke: 'var(--dsw-alias-bg-layer-2)', strokeWidth: 26 }),
            segments,
            h('text', { x: 100, y: 96, textAnchor: 'middle', style: { fontSize: '14px', fill: 'var(--dsw-alias-label-secondary)' } }, props.centerLabel),
            h('text', { x: 100, y: 120, textAnchor: 'middle', style: { fontSize: '19px', fontWeight: 600, fill: 'var(--dsw-alias-label-primary)' } }, fmtTokens(total)),
          ),
        ),
        h(
          'div',
          { className: 'dcm-donut-legend' },
          entries.map((entry) =>
            h(
              'div',
              { key: entry.key, className: 'dcm-donut-row' },
              h('span', { className: 'dcm-donut-swatch', style: { background: entry.color } }),
              h(
                'span',
                { className: 'dcm-donut-text' },
                h('span', { className: 'dcm-donut-name' }, props.labelOf(entry.key)),
                h('span', { className: 'dcm-donut-desc' }, props.descOf === undefined ? '' : props.descOf(entry.key)),
              ),
              h(
                'span',
                { className: 'dcm-donut-meta' },
                `${fmtTokens(entry.value)} · ${Math.round((entry.value / total) * 100)}%`,
              ),
            ),
          ),
        ),
      )
    }

    function BarList(props) {
      const entries = props.entries ?? []
      if (entries.length === 0) return h(Empty, null, props.emptyLabel)
      const max = Math.max(1, ...entries.map((entry) => entry.value))
      return h(
        'div',
        { className: 'dcm-bars' },
        entries.map((entry) =>
          h(
            'div',
            { key: entry.key, className: 'dcm-bar-row' },
            h(
              'div',
              { className: 'dcm-bar-head' },
              h('span', { className: 'dcm-bar-name', title: entry.label }, entry.label),
              h('span', { className: 'dcm-bar-val' }, entry.display),
            ),
            h(
              'div',
              { className: 'dcm-bar-track' },
              h('div', {
                className: 'dcm-bar-fill',
                style: { width: `${Math.max(2, (entry.value / max) * 100)}%`, background: entry.color ?? undefined },
              }),
            ),
          ),
        ),
      )
    }

    function CapacitySlider(props) {
      const max = Math.floor(props.max)
      if (!Number.isFinite(max) || max <= 0) return null
      const step = props.step ?? 1000
      const floor = Math.max(4096, Math.ceil((max * 0.1) / step) * step)
      const min = Math.min(floor, max)
      if (max <= min) return null
      const raw = typeof props.value === 'number' && Number.isFinite(props.value) ? props.value : max
      const value = Math.min(max, Math.max(min, Math.round(raw / step) * step))
      return h(
        'div',
        { className: 'dcm-slider-wrap' },
        h('input', {
          type: 'range',
          className: 'dcm-slider',
          min,
          max,
          step,
          value,
          'aria-label': props.label,
          onChange: (event) => props.onChange(Number(event.target.value)),
        }),
        h(
          'div',
          { className: 'dcm-slider-scale' },
          h('span', null, `${props.t('range.tenPercent')} · ${fmtTokens(min)}`),
          h('span', { className: 'dcm-slider-value' }, fmtTokens(value)),
          h('span', null, `${props.t('range.maximum')} · ${fmtTokens(max)}`),
        ),
      )
    }

    function CapacityGauge(props) {
      const capacity = Math.max(1, props.capacity)
      const usedPercent = Math.max(0, Math.min(100, (props.used / capacity) * 100))
      const thresholdPercent = Math.max(0, Math.min(100, props.thresholdPercent))
      const targetPercent = Math.max(0, Math.min(100, props.targetPercent))
      const protectPercent = Math.max(0, Math.min(100, props.protectPercent))
      const usedClass = usedPercent >= thresholdPercent ? 'dcm-split-danger' : usedPercent >= targetPercent ? 'dcm-split-warn' : 'dcm-split-used'
      return h(
        'div',
        null,
        h(
          'div',
          { className: 'dcm-split' },
          h('div', { className: usedClass, style: { width: `${usedPercent}%` } }),
          h('div', { className: 'dcm-split-protect', style: { right: 0, width: `${protectPercent}%` } }),
          h('div', { className: 'dcm-marker', style: { left: `${thresholdPercent}%`, background: 'var(--dsw-alias-state-error-primary)' }, title: props.thresholdLabel }),
          h('div', { className: 'dcm-marker', style: { left: `${targetPercent}%`, background: 'var(--dsw-alias-state-warn-primary)' }, title: props.targetLabel }),
        ),
        h(
          'div',
          { className: 'dcm-legend' },
          h('span', null, `${props.usedLabel} ${fmtTokens(props.used)} / ${fmtTokens(capacity)} (${fmtPercent(usedPercent)})`),
          h('span', null, `${props.targetLabel} ${fmtTokens((capacity * props.targetPercent) / 100)}`),
          h('span', null, `${props.thresholdLabel} ${fmtTokens((capacity * props.thresholdPercent) / 100)}`),
          h('span', null, `${props.protectLabel} ${fmtTokens((capacity * props.protectPercent) / 100)}`),
        ),
      )
    }

    /* ── shared visual pieces ────────────────────────────────────────────── */

    const RECOMMENDED_CAPACITIES = [
      { value: 131072, label: '128K' },
      { value: 262144, label: '256K' },
      { value: 524288, label: '512K' },
      { value: 1048576, label: '1M' },
    ]
    const STRATEGY_VALUES = ['summarize', 'prune-first', 'prune-only', 'truncate']
    const ENGINE_VALUES = ['auto', 'plugin', 'off']
    const MODE_VALUES = ['current', 'main', 'fixed']

    const ICON_PATHS = {
      sliders: [h('path', { d: 'M4 7h9M17 7h3M4 17h3M11 17h9', key: 'l' }), h('circle', { cx: 15, cy: 7, r: 2, key: 'a' }), h('circle', { cx: 9, cy: 17, r: 2, key: 'b' })],
      layers: [h('path', { d: 'M12 4 3 9l9 5 9-5-9-5Z', key: 'a' }), h('path', { d: 'M3 14l9 5 9-5', key: 'b' })],
      chart: [h('path', { d: 'M4 20V6', key: 'a' }), h('path', { d: 'M4 20h16', key: 'b' }), h('rect', { x: 7, y: 13, width: 3, height: 5, rx: 1, key: 'c' }), h('rect', { x: 12, y: 9, width: 3, height: 9, rx: 1, key: 'd' }), h('rect', { x: 17, y: 5, width: 3, height: 13, rx: 1, key: 'e' })],
      gauge: [h('path', { d: 'M4 17a8 8 0 1 1 16 0', key: 'a' }), h('path', { d: 'M12 17l4-5', key: 'b' }), h('circle', { cx: 12, cy: 17, r: 1.5, key: 'c' })],
      shield: [h('path', { d: 'M12 3l7 3v5c0 4.4-3 8-7 10-4-2-7-5.6-7-10V6l7-3Z', key: 'a' })],
      scissors: [h('circle', { cx: 7, cy: 7, r: 2, key: 'a' }), h('circle', { cx: 7, cy: 17, r: 2, key: 'b' }), h('path', { d: 'M9 8.5 20 19M9 15.5 20 5', key: 'c' })],
      brain: [h('path', { d: 'M12 5a3 3 0 0 0-3 3 3 3 0 0 0-1 5.8V17a3 3 0 0 0 4 2.8', key: 'a' }), h('path', { d: 'M12 5a3 3 0 0 1 3 3 3 3 0 0 1 1 5.8V17a3 3 0 0 1-4 2.8', key: 'b' })],
      bolt: [h('path', { d: 'M13 2 4 14h6l-1 8 9-12h-6l1-8Z', key: 'a' })],
      reset: [h('path', { d: 'M4 10a8 8 0 1 1 2.5 6.5', key: 'a' }), h('path', { d: 'M4 4v6h6', key: 'b' })],
      alert: [h('path', { d: 'M12 4 2.5 20h19L12 4Z', key: 'a' }), h('path', { d: 'M12 10v4', key: 'b' }), h('circle', { cx: 12, cy: 17.2, r: 0.9, key: 'c', fill: 'currentColor' })],
      check: [h('path', { d: 'M5 13l4 4L19 7', key: 'a' })],
      compare: [h('path', { d: 'M5 18V9', key: 'a' }), h('path', { d: 'M12 18V4', key: 'b' }), h('path', { d: 'M19 18v-6', key: 'c' }), h('path', { d: 'M3 21h18', key: 'd' })],
    }

    function Icon(props) {
      const paths = ICON_PATHS[props.name] ?? ICON_PATHS.sliders
      return h(
        'svg',
        {
          width: props.size ?? 14,
          height: props.size ?? 14,
          viewBox: '0 0 24 24',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.6,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': true,
          style: { display: 'block', flex: 'none' },
        },
        ...paths,
      )
    }

    function SectionTitle(props) {
      return h(
        'div',
        { className: 'dcm-sectionhead' },
        h('span', { className: 'dcm-sectionhead-icon' }, h(Icon, { name: props.icon, size: 14 })),
        h(
          'span',
          { className: 'dcm-sectionhead-text' },
          h('span', { className: 'dcm-subhead' }, props.title),
          props.hint === undefined ? null : h('span', { className: 'dcm-sectionhead-hint' }, props.hint),
        ),
        props.right === undefined ? null : h('span', { style: { marginLeft: 'auto' } }, props.right),
      )
    }

    function ConfirmDialog(props) {
      return h(
        'div',
        { className: 'dcm-modal-overlay', role: 'dialog', 'aria-modal': 'true' },
        h(
          'div',
          { className: 'dcm-modal' },
          h('div', { className: 'dcm-modal-title' }, h(Icon, { name: props.icon ?? 'alert', size: 15 }), props.title),
          h('div', { className: 'dcm-modal-body' }, props.body),
          h(
            'div',
            { className: 'dcm-modal-actions' },
            h('button', { type: 'button', className: 'dcm-btn', onClick: props.onCancel }, props.cancelLabel),
            h('button', { type: 'button', className: 'dcm-btn dcm-btn-primary', onClick: props.onConfirm }, props.confirmLabel),
          ),
        ),
      )
    }

    /* ── compression engine + billion-context statistics ─────────────────── */

    function EngineBanner(props) {
      const t = props.t
      const engine = props.engine
      if (engine === undefined || engine === null) return null
      const effective = engine.effective
      const bili = engine.bili ?? {}
      const badge = effective === 'plugin'
        ? h(Badge, { tone: 'ok' }, t('engine.badge.plugin'))
        : effective === 'bili'
          ? h(Badge, { tone: 'warn' }, t('engine.badge.bili'))
          : h(Badge, null, t('engine.badge.off'))
      const text = effective === 'plugin'
        ? t('engine.banner.plugin')
        : effective === 'bili'
          ? t('engine.banner.bili')
          : t('engine.banner.off')
      const origin = typeof bili.origin === 'string' && bili.origin.length > 0 ? bili.origin.replace(/\/+$/, '') : null
      const consoleLink = effective === 'bili' && origin !== null
        ? h(
            'a',
            { className: 'dcm-btn', href: `${origin}/__bili/`, target: '_blank', rel: 'noreferrer' },
            h(Icon, { name: 'bolt', size: 12 }),
            t('engine.openBili'),
          )
        : null
      const unavailableHint = bili.detected === true && bili.available === false
        ? h(
            'span',
            { className: 'dcm-hint' },
            t('engine.banner.biliUnavailable', { error: typeof bili.error === 'string' && bili.error.length > 0 ? bili.error : t('common.unknown') }),
          )
        : null
      return h(
        'div',
        { className: 'dcm-notice dcm-engine-banner' },
        h(Icon, { name: 'bolt', size: 14 }),
        badge,
        h('span', null, text),
        consoleLink,
        unavailableHint,
      )
    }

    function BiliStats(props) {
      const t = props.t
      const [value, error, loading, reload] = useApi('bili', { sessionId: props.sessionId ?? undefined })
      const refresh = h(
        'button',
        { type: 'button', className: 'dcm-btn', disabled: loading === true, onClick: reload },
        h(Icon, { name: 'reset', size: 12 }),
        t('common.refresh'),
      )
      const consoleButton = (url) =>
        h(
          'a',
          { className: 'dcm-btn', href: url, target: '_blank', rel: 'noreferrer' },
          h(Icon, { name: 'bolt', size: 12 }),
          t('bili.openConsole'),
        )
      if (value === undefined || value === null) {
        return h(
          'div',
          { className: 'dcm-card dcm-stack' },
          h(SectionTitle, { icon: 'brain', title: t('bili.title'), right: refresh }),
          error === undefined ? h(Loading) : h(ErrorBox, { prefix: t('error.load') + ': ', error }),
        )
      }
      const dashboardUrl = typeof value.dashboardUrl === 'string' && value.dashboardUrl.length > 0 ? value.dashboardUrl : null
      if (value.available !== true) {
        return h(
          'div',
          { className: 'dcm-card dcm-stack' },
          h(SectionTitle, {
            icon: 'brain',
            title: t('bili.title'),
            right: h(
              'div',
              { className: 'dcm-row' },
              dashboardUrl === null ? null : consoleButton(dashboardUrl),
              refresh,
            ),
          }),
          h(
            'div',
            { className: 'dcm-note' },
            typeof value.message === 'string' && value.message.length > 0 ? value.message : t('bili.unavailable'),
          ),
          error === undefined ? null : h(ErrorBox, { prefix: t('error.load') + ': ', error }),
        )
      }
      const version = typeof value.version === 'string' && value.version.length > 0 ? value.version : null
      const totals = value.totals ?? {}
      const sessions = Array.isArray(value.sessions) ? value.sessions : []
      const count = (number) => (typeof number === 'number' && Number.isFinite(number) ? String(Math.round(number)) : '—')
      const hit = (number) => (typeof number === 'number' && Number.isFinite(number) ? `${number}%` : '—')
      const columns = [
        'bili.col.session',
        'bili.col.blocks',
        'bili.col.context',
        'bili.col.input',
        'bili.col.cached',
        'bili.col.output',
        'bili.col.hit',
        'bili.col.restores',
        'bili.col.lastSeen',
      ]
      const header = h('thead', null, h('tr', null, columns.map((key) => h('th', { key }, t(key)))))
      const body = h(
        'tbody',
        null,
        sessions.map((session, index) => {
          const id = typeof session.id === 'string' ? session.id : ''
          const name = typeof session.title === 'string' && session.title.length > 0
            ? session.title
            : typeof session.label === 'string' && session.label.length > 0
              ? session.label
              : id.length > 0 ? id : t('common.unknown')
          return h(
            'tr',
            {
              key: id.length > 0 ? id : `bili-${index}`,
              style: session.matched === true
                ? { background: 'color-mix(in srgb, var(--dsw-alias-brand-primary) 6%, transparent)' }
                : undefined,
            },
            h(
              'td',
              { title: id },
              h('span', null, name),
              id.length === 0 ? null : h('span', { className: 'dcm-hint', style: { marginLeft: '6px' } }, shortId(id)),
              session.matched === true
                ? h('span', { style: { marginLeft: '6px' } }, h(Badge, { tone: 'ok' }, t('bili.matched')))
                : null,
            ),
            h('td', null, count(session.blocks)),
            h('td', null, fmtTokens(session.contextTokens)),
            h('td', null, fmtTokens(session.inputTokens)),
            h('td', null, fmtTokens(session.cachedTokens)),
            h('td', null, fmtTokens(session.outputTokens)),
            h('td', null, hit(session.cacheHitPct)),
            h('td', null, count(session.restores)),
            h('td', null, fmtTime(session.lastSeen)),
          )
        }),
      )
      const table = sessions.length === 0
        ? h(Empty, null, t('common.empty'))
        : h('div', { className: 'dcm-scroll' }, h('table', { className: 'dcm-table' }, header, body))
      return h(
        'div',
        { className: 'dcm-card dcm-stack' },
        h(SectionTitle, {
          icon: 'brain',
          title: t('bili.title'),
          hint: version === null ? undefined : t('bili.hint', { version }),
          right: h(
            'div',
            { className: 'dcm-row' },
            dashboardUrl === null ? null : consoleButton(dashboardUrl),
            refresh,
          ),
        }),
        h(
          'div',
          { className: 'dcm-kpis dcm-kpis-4' },
          h(
            'div',
            { className: 'dcm-kpi' },
            h('div', { className: 'dcm-kpi-v' }, count(totals.sessions)),
            h('div', { className: 'dcm-kpi-l' }, t('bili.kpi.sessions')),
          ),
          h(
            'div',
            { className: 'dcm-kpi' },
            h('div', { className: 'dcm-kpi-v' }, count(totals.blocks)),
            h('div', { className: 'dcm-kpi-l' }, t('bili.kpi.blocks')),
          ),
          h(
            'div',
            { className: 'dcm-kpi' },
            h('div', { className: 'dcm-kpi-v' }, fmtTokens(totals.contextTokens)),
            h('div', { className: 'dcm-kpi-l' }, t('bili.kpi.context')),
          ),
          h(
            'div',
            { className: 'dcm-kpi' },
            h('div', { className: 'dcm-kpi-v' }, hit(totals.cacheHitPct)),
            h('div', { className: 'dcm-kpi-l' }, t('bili.kpi.cacheHit')),
          ),
        ),
        table,
        typeof value.cacheReport === 'string' && value.cacheReport.length > 0
          ? h(
              'details',
              { className: 'dcm-details' },
              h('summary', null, t('bili.cacheReport')),
              h('pre', { className: 'dcm-pre' }, value.cacheReport),
            )
          : null,
        error === undefined ? null : h(ErrorBox, { prefix: t('error.load') + ': ', error }),
      )
    }

    /* ── policy form ─────────────────────────────────────────────────────── */

    function PolicyForm(props) {
      const t = props.t
      const source = props.value ?? {}
      const [draft, setDraft] = React.useState(() => ({ ...source }))
      const [saving, setSaving] = React.useState(false)
      const [error, setError] = React.useState(undefined)
      const [saved, setSaved] = React.useState(false)
      React.useEffect(() => {
        setDraft({ ...source })
        setSaved(false)
        setError(undefined)
      }, [JSON.stringify(source)])
      const patch = (key, value) => setDraft((current) => ({ ...current, [key]: value }))
      const effective = (key, fallback) => (draft[key] === undefined || draft[key] === null ? fallback : draft[key])
      const declared = typeof props.realCapacity === 'number' ? props.realCapacity : null
      const draftCapacity = draft.capacity ?? null
      const draftMax = draft.maxCapacity ?? null
      const modelMax = draftMax ?? declared
      const effectiveCapacity = draftCapacity ?? modelMax ?? 0
      const submit = async () => {
        setSaving(true)
        setError(undefined)
        try {
          const body = { patch: {} }
          for (const key of props.fields ?? []) {
            if (draft[key] !== undefined) body.patch[key] = draft[key]
          }
          if (Object.keys(body.patch).length === 0) body.patch.thresholdPercent = effective('thresholdPercent', 80)
          await props.onSave(body.patch)
          setSaved(true)
        } catch (failure) {
          setError(failure)
        } finally {
          setSaving(false)
        }
      }
      const clear = async () => {
        setSaving(true)
        setError(undefined)
        try {
          await props.onClear()
          setSaved(true)
        } catch (failure) {
          setError(failure)
        } finally {
          setSaving(false)
        }
      }
      const routes = props.routes ?? []
      const providers = [...new Set(routes.map((route) => route.provider))].sort()
      const showCapacity = props.showCapacity !== false
      const showMaxCapacity = props.showMaxCapacity === true
      const showAuto = props.showAuto !== false
      const showEngine = props.showEngine === true
      return h(
        'div',
        { className: 'dcm-stack' },
        showCapacity
          ? h(Field, {
              label: h('span', { className: 'dcm-label' }, h(Icon, { name: 'gauge', size: 12 }), t('capacity.title')),
              hint: t('capacity.default', { value: modelMax === null ? t('common.none') : fmtTokens(modelMax) }),
              control: h(
                'div',
                { className: 'dcm-stack', style: { gap: '7px' } },
                h(
                  'div',
                  { className: 'dcm-inline' },
                  h(NumberInput, {
                    label: t('capacity.title'),
                    value: draftCapacity,
                    min: 4096,
                    step: 1024,
                    placeholder: modelMax === null ? t('common.none') : fmtTokens(modelMax),
                    onChange: (value) => patch('capacity', value),
                  }),
                  h('button', { type: 'button', className: 'dcm-chip', onClick: () => patch('capacity', null) }, t('capacity.useDefault')),
                ),
                h(
                  'div',
                  { className: 'dcm-chips' },
                  h('span', { className: 'dcm-hint' }, t('capacity.recommended')),
                  RECOMMENDED_CAPACITIES.map((entry) =>
                    h(
                      'button',
                      {
                        key: entry.value,
                        type: 'button',
                        className: 'dcm-chip' + (draftCapacity === entry.value ? ' dcm-chip-on' : ''),
                        onClick: () => patch('capacity', entry.value),
                      },
                      entry.label,
                    ),
                  ),
                ),
                modelMax === null
                  ? null
                  : h(CapacitySlider, {
                      t,
                      max: modelMax,
                      value: draftCapacity ?? modelMax,
                      step: 1000,
                      label: t('capacity.slider'),
                      onChange: (value) => patch('capacity', value),
                    }),
              ),
            })
          : h(
              'div',
              { className: 'dcm-note' },
              t('defaults.capacityNotePrefix'),
              props.onOpenModels === undefined
                ? h('span', { className: 'dcm-note-ref' }, h(Icon, { name: 'layers', size: 14 }), t('tab.models'))
                : h(
                    'button',
                    { type: 'button', className: 'dcm-note-ref dcm-note-link', onClick: props.onOpenModels },
                    h(Icon, { name: 'layers', size: 14 }),
                    t('tab.models'),
                  ),
              t('defaults.capacityNoteSuffix'),
            ),
        showMaxCapacity
          ? h(Field, {
              label: h('span', { className: 'dcm-label' }, h(Icon, { name: 'layers', size: 12 }), t('capacity.maxField')),
              hint: t('capacity.maxHint', { value: declared === null ? t('common.none') : fmtTokens(declared) }),
              control: h(NumberInput, {
                label: t('capacity.maxField'),
                value: draftMax,
                min: 4096,
                step: 1024,
                placeholder: declared === null ? t('common.none') : fmtTokens(declared),
                onChange: (value) => patch('maxCapacity', value),
              }),
            })
          : null,
        h(Field, {
          label: h('span', { className: 'dcm-label' }, h(Icon, { name: 'bolt', size: 12 }), t('field.threshold')),
          hint: t('field.threshold.hint'),
          control: h(PercentSlider, {
            label: t('field.threshold'),
            min: 10,
            max: 95,
            value: effective('thresholdPercent', 80),
            onChange: (value) => patch('thresholdPercent', value),
          }),
        }),
        h(Field, {
          label: h('span', { className: 'dcm-label' }, h(Icon, { name: 'compare', size: 12 }), t('field.target')),
          hint: t('field.target.hint'),
          control: h(PercentSlider, {
            label: t('field.target'),
            min: 5,
            max: 90,
            value: effective('targetPercent', 40),
            onChange: (value) => patch('targetPercent', value),
          }),
        }),
        h(Field, {
          label: h('span', { className: 'dcm-label' }, h(Icon, { name: 'shield', size: 12 }), t('field.protect')),
          hint: t('field.protect.hint'),
          control: h(PercentSlider, {
            label: t('field.protect'),
            min: 0,
            max: 80,
            value: effective('protectPercent', 16),
            onChange: (value) => patch('protectPercent', value),
          }),
        }),
        showEngine
          ? h(Field, {
              label: h('span', { className: 'dcm-label' }, h(Icon, { name: 'bolt', size: 12 }), t('engine.title')),
              control: h(
                'div',
                { className: 'dcm-strategies', role: 'radiogroup', 'aria-label': t('engine.title') },
                ENGINE_VALUES.map((value) =>
                  h(
                    'button',
                    {
                      key: value,
                      type: 'button',
                      role: 'radio',
                      'aria-checked': effective('engine', 'auto') === value,
                      className: 'dcm-strategycard' + (effective('engine', 'auto') === value ? ' dcm-strategycard-on' : ''),
                      onClick: () => patch('engine', value),
                    },
                    h('span', { className: 'dcm-strategyradio' + (effective('engine', 'auto') === value ? ' dcm-strategyradio-on' : '') }),
                    h(
                      'span',
                      null,
                      h('span', { className: 'dcm-strategy-title' }, t('engine.' + value + '.title')),
                      h('span', { className: 'dcm-strategy-desc' }, t('engine.' + value + '.desc')),
                    ),
                  ),
                ),
              ),
            })
          : null,
        h(Field, {
          label: h('span', { className: 'dcm-label' }, h(Icon, { name: 'scissors', size: 12 }), t('field.strategy')),
          hint: t('strategy.hint'),
          control: h(
            'div',
            { className: 'dcm-strategies', role: 'radiogroup', 'aria-label': t('field.strategy') },
            STRATEGY_VALUES.map((value) =>
              h(
                'button',
                {
                  key: value,
                  type: 'button',
                  role: 'radio',
                  'aria-checked': effective('strategy', 'summarize') === value,
                  className: 'dcm-strategycard' + (effective('strategy', 'summarize') === value ? ' dcm-strategycard-on' : ''),
                  onClick: () => patch('strategy', value),
                },
                h('span', { className: 'dcm-strategyradio' + (effective('strategy', 'summarize') === value ? ' dcm-strategyradio-on' : '') }),
                h(
                  'span',
                  null,
                  h('span', { className: 'dcm-strategy-title' }, t('strategy.' + value + '.title')),
                  h('span', { className: 'dcm-strategy-desc' }, t('strategy.' + value + '.desc')),
                ),
              ),
            ),
          ),
        }),
        h(Field, {
          label: h('span', { className: 'dcm-label' }, h(Icon, { name: 'brain', size: 12 }), t('field.model')),
          control: h(
            'div',
            { className: 'dcm-stack', style: { gap: '8px' } },
            h(Segmented, {
              label: t('field.model'),
              value: effective('compactionMode', 'current'),
              onChange: (value) => patch('compactionMode', value),
              options: MODE_VALUES.map((value) => ({ value, label: t('field.model.' + value) })),
            }),
            effective('compactionMode', 'current') === 'fixed'
              ? h(
                  'div',
                  { className: 'dcm-inline' },
                  h(Select, {
                    label: t('field.model.provider'),
                    value: draft.compactionProvider ?? '',
                    onChange: (value) => patch('compactionProvider', value),
                    options: [{ value: '', label: t('field.model.provider') }, ...providers.map((provider) => ({ value: provider, label: provider }))],
                  }),
                  h(Select, {
                    label: t('field.model.model'),
                    value: draft.compactionModel ?? '',
                    onChange: (value) => patch('compactionModel', value),
                    options: [
                      { value: '', label: t('field.model.model') },
                      ...routes
                        .filter((route) => route.provider === (draft.compactionProvider ?? ''))
                        .map((route) => ({ value: route.model, label: route.model })),
                    ],
                  }),
                )
              : null,
          ),
        }),
        showAuto
          ? h(Field, {
              label: h('span', { className: 'dcm-label' }, h(Icon, { name: 'bolt', size: 12 }), t('field.auto')),
              hint: t('field.auto.hint'),
              control: h(Toggle, { label: t('field.auto'), value: effective('auto', true), onChange: (value) => patch('auto', value) }),
            })
          : null,
        error === undefined ? null : h(ErrorBox, { prefix: t('error.save') + ': ', error }),
        h(
          'div',
          { className: 'dcm-row' },
          h('button', { type: 'button', className: 'dcm-btn dcm-btn-primary', disabled: saving, onClick: submit }, saving ? t('common.saving') : t('common.save')),
          props.onClear === undefined ? null : h('button', { type: 'button', className: 'dcm-btn', disabled: saving, onClick: clear }, t('common.clear')),
          saved ? h(Badge, { tone: 'ok' }, t('common.saved')) : null,
        ),
      )
    }

    /* ── records view ────────────────────────────────────────────────────── */

    const EMPTY_TOTALS = {
      count: 0,
      sessions: 0,
      freedTokens: 0,
      avgFreedPerSession: 0,
      summarizationTokens: 0,
      breakdown: {},
      strategies: {},
      models: {},
    }

    function RecordsTable(props) {
      const t = props.t
      const records = props.records ?? []
      const columns = [
        'table.at',
        'table.session',
        'table.trigger',
        'table.strategy',
        'table.model',
        'table.before',
        'table.after',
        'table.freed',
        'table.summaryTokens',
        'table.nodes',
      ]
      const header = h('thead', null, h('tr', null, columns.map((key) => h('th', { key }, t(key)))))
      const body = h(
        'tbody',
        null,
        records.slice(0, 200).map((record) =>
          h(
            'tr',
            { key: record.id ?? record.sessionId + ':' + record.at },
            h('td', null, fmtTime(record.at)),
            h('td', { title: record.sessionId }, shortId(record.sessionId)),
            h('td', null, t('trigger.' + (record.trigger ?? 'manual'))),
            h('td', null, t('field.strategy.' + (record.strategy ?? 'summarize'))),
            h('td', null, (record.summarizationProvider ?? '') + '/' + (record.summarizationModel ?? '')),
            h('td', null, fmtTokens(record.tokensBefore)),
            h('td', null, fmtTokens(record.tokensAfter)),
            h('td', null, fmtTokens(record.freedTokens)),
            h('td', null, fmtTokens(record.summarizationTokens)),
            h('td', null, String(record.shadowedNodes ?? '—')),
          ),
        ),
      )
      return h('div', { className: 'dcm-scroll' }, h('table', { className: 'dcm-table' }, header, body))
    }

    function RecordsView(props) {
      const t = props.t
      const [range, setRange] = React.useState(props.defaultRange ?? '7d')
      const [value, error, loading, reload] = useApi('records', {
        sessionId: props.sessionId ?? undefined,
        range,
        limit: 300,
      })
      const records = value?.records ?? []
      const totals = value?.totals ?? EMPTY_TOTALS
      const strategyEntries = Object.entries(totals.strategies ?? {})
        .map(([key, stat]) => ({
          key,
          label: t('strategy.' + key + '.title'),
          value: stat?.count ?? stat ?? 0,
          display: `${stat?.count ?? stat ?? 0} · ${fmtTokens(stat?.freedTokens ?? 0)}`,
        }))
        .sort((left, right) => right.value - left.value)
      const modelEntriesRaw = Object.entries(totals.models ?? {}).map(([key, stat]) => ({
        key,
        label: key,
        value: stat?.summarizationTokens ?? 0,
        count: stat?.count ?? 0,
      }))
      const tokensKnown = modelEntriesRaw.some((entry) => entry.value > 0)
      const modelEntries = modelEntriesRaw
        .map((entry) => ({
          key: entry.key,
          label: entry.label,
          value: tokensKnown ? entry.value : entry.count,
          display: tokensKnown
            ? `${fmtTokens(entry.value)} · ${entry.count}`
            : `${entry.count} · ${t('chart.legacyNoUsage')}`,
        }))
        .sort((left, right) => right.value - left.value)
      const kpis = h(
        'div',
        { className: 'dcm-kpis' },
        h(
          'div',
          { className: 'dcm-kpi' },
          h('div', { className: 'dcm-kpi-v' }, `${totals.sessions ?? 0} · ${totals.count ?? 0}`),
          h('div', { className: 'dcm-kpi-l' }, t('kpi.sessionsCompactions')),
        ),
        h(
          'div',
          { className: 'dcm-kpi' },
          h('div', { className: 'dcm-kpi-v' }, fmtTokens(totals.freedTokens)),
          h('div', { className: 'dcm-kpi-l' }, t('kpi.totalFreed')),
        ),
        h(
          'div',
          { className: 'dcm-kpi' },
          h('div', { className: 'dcm-kpi-v' }, fmtTokens(totals.avgFreedPerSession)),
          h('div', { className: 'dcm-kpi-l' }, t('kpi.avgFreed')),
        ),
      )
      const empty = records.length === 0
      return h(
        'div',
        { className: 'dcm-stack' },
        props.biliActive === true ? h('div', { className: 'dcm-note' }, t('records.biliNote')) : null,
        h(RangeSelector, {
          t,
          value: range,
          onChange: setRange,
          label: t('range.label'),
        }),
        kpis,
        error === undefined ? null : h(ErrorBox, { prefix: t('error.load') + ': ', error }),
        loading && records.length === 0 ? h(Loading) : null,
        empty && !loading ? h('div', { className: 'dcm-card' }, h(Empty, null, t('chart.noRecords'))) : null,
        empty
          ? null
          : h(
              'div',
              { className: 'dcm-card' },
              h(SectionTitle, { icon: 'compare', title: t('chart.beforeAfter') }),
              h(BeforeAfterChart, {
                records,
                title: t('chart.beforeAfter'),
                beforeLabel: t('chart.before'),
                afterLabel: t('chart.after'),
                emptyLabel: t('chart.noRecords'),
              }),
            ),
        empty
          ? null
          : h(
              'div',
              { className: 'dcm-card' },
              h(SectionTitle, { icon: 'chart', title: t('chart.breakdown'), hint: t('chart.breakdownHint') }),
              h(DonutChart, {
                totals: totals.breakdown ?? {},
                title: t('chart.breakdown'),
                centerLabel: t('chart.compressedTotal'),
                labelOf: (key) => t('cat.' + key),
                descOf: (key) => t('catDesc.' + key),
                emptyLabel: t('common.empty'),
              }),
            ),
        empty
          ? null
          : h(
              'div',
              { className: 'dcm-two' },
              h(
                'div',
                { className: 'dcm-card' },
                h(SectionTitle, { icon: 'scissors', title: t('chart.strategies'), hint: t('chart.strategiesHint') }),
                h(BarList, {
                  entries: strategyEntries,
                  emptyLabel: t('common.empty'),
                }),
              ),
              h(
                'div',
                { className: 'dcm-card' },
                h(SectionTitle, { icon: 'brain', title: t('chart.models'), hint: t('chart.modelsHint') }),
                h(BarList, {
                  entries: modelEntries,
                  emptyLabel: t('common.empty'),
                }),
              ),
            ),
        empty
          ? null
          : h(
              'div',
              { className: 'dcm-card' },
              h(SectionTitle, { icon: 'layers', title: t('records.title'), hint: t('records.desc') }),
              h(RecordsTable, { t, records }),
            ),
        h(
          'div',
          { className: 'dcm-row', style: { justifyContent: 'flex-end' } },
          h('button', { type: 'button', className: 'dcm-btn', onClick: reload }, t('common.refresh')),
        ),
      )
    }

    /* ── management page (main panel + settings page) ────────────────────── */

    function ManagementPage(props) {
      const t = props.t
      const [tab, setTab] = React.useState('defaults')
      const [state, stateError, stateLoading, reloadState] = useApi('state')
      const [catalog] = useApi('catalog')
      const [selectedRoute, setSelectedRoute] = React.useState(null)
      const [filter, setFilter] = React.useState('')
      const routes = catalog?.routes ?? []
      const route = selectedRoute === null ? null : routes.find((candidate) => candidate.provider === selectedRoute.provider && candidate.model === selectedRoute.model) ?? null
      const engine = state?.engine
      const biliActive = engine?.effective === 'bili'
      const biliVisible = engine?.bili?.detected === true || biliActive
      const saveGlobal = async (patch) => {
        await api('global', { patch })
        reloadState()
      }
      const clearGlobal = async () => {
        await api('global', { patch: null })
        reloadState()
      }
      const saveModel = async (patch) => {
        if (route === null) throw new Error(t('models.pickHint'))
        await api('model', { provider: route.provider, model: route.model, patch })
        reloadState()
      }
      const clearModel = async () => {
        if (route === null) return
        await api('model', { provider: route.provider, model: route.model, patch: null })
        reloadState()
      }
      const tabs = [
        { id: 'defaults', label: t('tab.defaults'), icon: 'sliders' },
        { id: 'models', label: t('tab.models'), icon: 'layers' },
        { id: 'records', label: t('tab.records'), icon: 'chart' },
      ]
      const head = h(
        'div',
        { className: 'dcm-head' },
        h(
          'div',
          null,
          h('h2', { className: 'dcm-title' }, t('panel.title')),
          h('p', { className: 'dcm-sub' }, t('panel.subtitle')),
        ),
        props.close === undefined
          ? h('button', { type: 'button', className: 'dcm-btn', onClick: reloadState }, t('common.refresh'))
          : h(
              'div',
              { className: 'dcm-row' },
              h('button', { type: 'button', className: 'dcm-btn', onClick: reloadState }, t('common.refresh')),
              h('button', { type: 'button', className: 'dcm-btn', onClick: props.close }, t('common.close')),
            ),
      )
      const tabRow = h(
        'div',
        { className: 'dcm-tabs', role: 'tablist' },
        tabs.map((entry) =>
          h(
            'button',
            {
              key: entry.id,
              type: 'button',
              role: 'tab',
              'aria-selected': tab === entry.id,
              className: 'dcm-tab' + (tab === entry.id ? ' dcm-tab-on' : ''),
              onClick: () => setTab(entry.id),
            },
            h(Icon, { name: entry.icon, size: 13 }),
            entry.label,
          ),
        ),
      )
      const defaults = h(
        'div',
        { className: 'dcm-stack' },
        h(
          'div',
          { className: 'dcm-grid' },
          h(
            'div',
            { className: 'dcm-card' },
            h(SectionTitle, { icon: 'sliders', title: t('defaults.title'), hint: t('defaults.desc') }),
            h(PolicyForm, {
              t,
              value: state?.global ?? {},
              fields: ['engine', 'thresholdPercent', 'targetPercent', 'protectPercent', 'strategy', 'compactionMode', 'compactionProvider', 'compactionModel', 'auto'],
              routes,
              realCapacity: null,
              showCapacity: false,
              showMaxCapacity: false,
              showEngine: true,
              onSave: saveGlobal,
              onClear: clearGlobal,
              onOpenModels: () => setTab('models'),
            }),
          ),
          h(RecordsView, { t, sessionId: undefined, biliActive }),
        ),
        biliVisible ? h(BiliStats, { t, sessionId: undefined }) : null,
      )
      const filteredRoutes = routes.filter((candidate) => `${candidate.provider}/${candidate.model}`.toLowerCase().includes(filter.toLowerCase()))
      const cards = filteredRoutes.slice(0, 400).map((candidate) => {
        const active = route !== null && route.provider === candidate.provider && route.model === candidate.model
        const override = candidate.override ?? {}
        const hasOverride = Object.keys(override).length > 0
        const capacity = override.capacity ?? override.maxCapacity ?? null
        return h(
          'button',
          {
            key: `${candidate.provider}/${candidate.model}`,
            type: 'button',
            className: 'dcm-modelcard' + (active ? ' dcm-modelcard-on' : ''),
            onClick: () => setSelectedRoute({ provider: candidate.provider, model: candidate.model }),
            title: t('models.editTitle', { name: candidate.model }),
          },
          h(
            'span',
            { className: 'dcm-modelcard-top' },
            h('span', { className: 'dcm-modelcard-name' }, candidate.model),
            h(Badge, { tone: hasOverride ? 'warn' : undefined }, hasOverride ? t('models.cardOverride') : t('models.cardDefault')),
          ),
          h('span', { className: 'dcm-modelcard-meta' }, candidate.provider),
          h(
            'span',
            { className: 'dcm-modelcard-meta' },
            t('models.cardDeclared', { value: fmtTokens(candidate.contextWindow) }) +
              (capacity === null ? '' : ' · ' + t('models.cardCapacity', { value: fmtTokens(capacity) })),
          ),
        )
      })
      const models = h(
        'div',
        { className: 'dcm-grid' },
        h(
          'div',
          { className: 'dcm-card' },
          h(SectionTitle, { icon: 'layers', title: t('models.title'), hint: t('models.desc') }),
          h('input', {
            className: 'dcm-input',
            placeholder: t('models.search'),
            value: filter,
            onChange: (event) => setFilter(event.target.value),
            'aria-label': t('models.search'),
          }),
          routes.length === 0
            ? h(Empty, null, t('models.empty'))
            : h('div', { className: 'dcm-modelgrid', style: { marginTop: '10px' } }, cards),
        ),
        h(
          'div',
          { className: 'dcm-card' },
          route === null
            ? h(SectionTitle, { icon: 'brain', title: t('models.title'), hint: t('models.pickHint') })
            : h(
                'div',
                { className: 'dcm-stack' },
                h(SectionTitle, {
                  icon: 'brain',
                  title: t('models.editTitle', { name: route.model }),
                  hint: `${route.provider} · ${t('models.cardDeclared', { value: fmtTokens(route.contextWindow) })}`,
                }),
                route.override !== null && typeof route.override === 'object' && Object.keys(route.override).length > 0
                  ? h('div', { className: 'dcm-note' }, t('capacity.priorityNote'))
                  : null,
                h(PolicyForm, {
                  t,
                  value: route.override ?? {},
                  fields: ['capacity', 'maxCapacity', 'thresholdPercent', 'targetPercent', 'protectPercent', 'strategy', 'compactionMode', 'compactionProvider', 'compactionModel', 'auto'],
                  routes,
                  realCapacity: route.contextWindow,
                  showCapacity: true,
                  showMaxCapacity: true,
                  onSave: saveModel,
                  onClear: clearModel,
                }),
              ),
        ),
      )
      const records = h(RecordsView, { t, sessionId: undefined, biliActive })
      return h(
        'div',
        { className: 'dcm-root' },
        head,
        tabRow,
        h(EngineBanner, { t, engine }),
        stateError === undefined ? null : h(ErrorBox, { prefix: t('error.load') + ': ', error: stateError }),
        stateLoading && state === undefined ? h(Loading) : null,
        tab === 'defaults' ? defaults : null,
        tab === 'models' ? models : null,
        tab === 'records' ? records : null,
      )
    }
    /* ── session view ────────────────────────────────────────────────────── */

    function SessionView(props) {
      const t = props.t
      const sessionId = props.sessionId
      const [value, error, loading, reload] = useApi('session', { sessionId })
      const [records, , , reloadRecords] = useApi('records', { sessionId, limit: 60 })
      const [draft, setDraft] = React.useState(null)
      const [busy, setBusy] = React.useState(false)
      const [actionError, setActionError] = React.useState(undefined)
      const [notice, setNotice] = React.useState(undefined)
      const [dialog, setDialog] = React.useState(null)
      React.useEffect(() => {
        if (value === undefined || value === null || value.routed === false) return
        setDraft({
          capacity: value.capacity ?? null,
          thresholdPercent: value.thresholdPercent ?? 80,
          targetPercent: value.targetPercent ?? 40,
          protectPercent: value.protectPercent ?? 16,
          strategy: value.strategy ?? 'summarize',
        })
      }, [value === undefined || value === null ? '' : `${value.capacity}:${value.thresholdPercent}:${value.targetPercent}:${value.protectPercent}:${value.strategy}:${value.policySource}`])
      if (loading && value === undefined) {
        return h('div', { className: 'dcm-root' }, h(Loading))
      }
      if (value !== undefined && value !== null && value.routed === false) {
        const notRoutedEngine = value.engine
        return h(
          'div',
          { className: 'dcm-root' },
          h('h2', { className: 'dcm-title' }, t('session.title')),
          h('p', { className: 'dcm-sub' }, t('session.notRouted')),
          h(EngineBanner, { t, engine: notRoutedEngine }),
          h(RecordsView, { t, sessionId, biliActive: notRoutedEngine?.effective === 'bili' }),
        )
      }
      const current = value ?? {}
      const engine = value?.engine
      const pluginActive = engine === undefined || engine === null ? true : engine.effective === 'plugin'
      const biliActive = engine?.effective === 'bili'
      const biliVisible = biliActive || engine?.bili?.detected === true
      const patch = (key, next) => setDraft((previous) => ({ ...(previous ?? {}), [key]: next }))
      const capacity = draft?.capacity ?? current.capacity ?? 1
      const thresholdPercent = draft?.thresholdPercent ?? current.thresholdPercent ?? 80
      const targetPercent = draft?.targetPercent ?? current.targetPercent ?? 40
      const protectPercent = draft?.protectPercent ?? current.protectPercent ?? 16
      const used = typeof current.usedTokens === 'number' ? current.usedTokens : 0
      const thresholdTokens = typeof current.thresholdTokens === 'number' ? current.thresholdTokens : Math.round((capacity * thresholdPercent) / 100)
      const targetTokens = typeof current.targetTokens === 'number' ? current.targetTokens : Math.round((capacity * targetPercent) / 100)
      const manualGate = used >= thresholdTokens ? 'direct' : used >= targetTokens ? 'confirm' : 'blocked'
      const closeDialog = () => setDialog(null)
      const apply = async (confirm = false) => {
        setBusy(true)
        setActionError(undefined)
        setNotice(undefined)
        try {
          const result = await api('session', { sessionId, patch: draft, confirm })
          if (result?.needsConfirmation === true) {
            setDialog({
              kind: 'shrink',
              title: t('shrink.title'),
              body: t('shrink.body', { used: fmtTokens(result.currentTokens), capacity: fmtTokens(result.targetCapacity) }),
              confirmLabel: t('shrink.confirm'),
              onConfirm: () => apply(true),
            })
          } else {
            setDialog(null)
            if (result?.compaction?.compacted === true) {
              setNotice(t('compaction.done', { before: fmtTokens(result.compaction.beforeTokens), after: fmtTokens(result.compaction.afterTokens), freed: fmtTokens(result.compaction.freedTokens) }))
            }
            reload()
            reloadRecords()
          }
        } catch (failure) {
          setActionError(failure)
          setDialog(null)
        } finally {
          setBusy(false)
        }
      }
      const runCompact = async (confirm = false) => {
        setBusy(true)
        setActionError(undefined)
        setNotice(undefined)
        try {
          const result = await api('compact', { sessionId, reason: 'manual', confirm })
          if (result?.needsConfirmation === true) {
            setDialog({
              kind: 'manual',
              title: t('manual.confirmTitle'),
              body: t('manual.confirmBody', {
                used: fmtTokens(result.usedTokens ?? used),
                threshold: fmtTokens(result.thresholdTokens ?? thresholdTokens),
                target: fmtTokens(result.targetTokens ?? targetTokens),
              }),
              confirmLabel: t('common.continue'),
              onConfirm: () => runCompact(true),
            })
          } else {
            setDialog(null)
            setNotice(result?.compacted === true
              ? t('compaction.done', { before: fmtTokens(result.beforeTokens), after: fmtTokens(result.afterTokens), freed: fmtTokens(result.freedTokens) })
              : t('compaction.none'))
            reload()
            reloadRecords()
          }
        } catch (failure) {
          setActionError(failure)
          setDialog(null)
        } finally {
          setBusy(false)
        }
      }
      const requestReset = () => {
        setDialog({
          kind: 'reset',
          title: t('reset.confirmTitle'),
          body: t('reset.confirmBody', { capacity: fmtTokens(current.defaultCapacity ?? current.realCapacity) }),
          confirmLabel: t('common.continue'),
          onConfirm: () => runReset(false),
        })
      }
      const runReset = async (confirm = false) => {
        setBusy(true)
        setActionError(undefined)
        setNotice(undefined)
        try {
          const result = await api('session', { sessionId, reset: true, confirm })
          if (result?.needsConfirmation === true) {
            setDialog({
              kind: 'reset-compaction',
              title: t('reset.compactionTitle'),
              body: t('reset.compactionBody', { capacity: fmtTokens(result.targetCapacity), used: fmtTokens(result.currentTokens) }),
              confirmLabel: t('common.continue'),
              onConfirm: () => runReset(true),
            })
          } else {
            setDialog(null)
            setNotice(t('reset.done', { capacity: fmtTokens(result?.state?.defaultCapacity ?? result?.state?.capacity ?? current.defaultCapacity) }))
            reload()
            reloadRecords()
          }
        } catch (failure) {
          setActionError(failure)
          setDialog(null)
        } finally {
          setBusy(false)
        }
      }
      const buttons = h(
        'div',
        { className: 'dcm-row' },
        h('button', { type: 'button', className: 'dcm-btn dcm-btn-primary', disabled: busy, onClick: () => apply(false) }, t('session.apply')),
        h(
          'button',
          {
            type: 'button',
            className: 'dcm-btn',
            disabled: busy || manualGate === 'blocked' || !pluginActive,
            title: !pluginActive
              ? (engine.effective === 'bili' ? t('session.delegatedHint') : t('session.disabledHint'))
              : manualGate === 'blocked' ? t('manual.gate.blocked', { used: fmtTokens(used), target: fmtTokens(targetTokens) }) : undefined,
            onClick: () => {
              if (!pluginActive) return
              if (manualGate === 'blocked') return
              if (manualGate === 'confirm') runCompact(false)
              else runCompact(false)
            },
          },
          busy ? t('session.compacting') : t('session.compact'),
        ),
        h('button', { type: 'button', className: 'dcm-btn', disabled: busy, onClick: requestReset }, h(Icon, { name: 'reset', size: 12 }), t('reset.button')),
      )
      const gateHint = !pluginActive
        ? h('div', { className: 'dcm-hint' }, engine.effective === 'bili' ? t('session.delegatedHint') : t('session.disabledHint'))
        : manualGate === 'blocked'
          ? h('div', { className: 'dcm-hint' }, t('manual.gate.blocked', { used: fmtTokens(used), target: fmtTokens(targetTokens) }))
          : h('div', { className: 'dcm-hint' }, t('manual.gate.hint', { used: fmtTokens(used), threshold: fmtTokens(thresholdTokens), target: fmtTokens(targetTokens) }))
      return h(
        'div',
        { className: 'dcm-root' },
        h(
          'div',
          { className: 'dcm-head' },
          h('div', null,
            h('h2', { className: 'dcm-title' }, t('session.title')),
            h('p', { className: 'dcm-sub' }, t('session.desc')),
          ),
          h('div', { className: 'dcm-row' },
            h(Badge, null, `${current.provider ?? ''}/${current.model ?? ''}`),
            h(Badge, null, t(`source.${current.policySource ?? 'global'}`)),
            h('button', { type: 'button', className: 'dcm-btn', onClick: () => { reload(); reloadRecords() } }, t('common.refresh')),
          ),
        ),
        h(EngineBanner, { t, engine }),
        error === undefined ? null : h(ErrorBox, { prefix: t('error.load') + ': ', error }),
        h(
          'div',
          { className: 'dcm-grid' },
          h(
            'div',
            { className: 'dcm-card dcm-stack' },
            h(SectionTitle, { icon: 'gauge', title: t('session.title'), hint: t('session.desc') }),
            h(CapacityGauge, {
              capacity,
              used,
              thresholdPercent,
              targetPercent,
              protectPercent,
              usedLabel: t('marker.used'),
              thresholdLabel: t('marker.threshold'),
              targetLabel: t('marker.target'),
              protectLabel: t('field.protect'),
            }),
            h('div', { className: 'dcm-row' },
              h('span', { className: 'dcm-hint' }, t('session.real', { value: fmtTokens(current.realCapacity) })),
              h('span', { className: 'dcm-hint' }, t('session.defaultCapacity', { value: fmtTokens(current.defaultCapacity) })),
              h('span', { className: 'dcm-hint' }, t('session.source', { source: t(`source.${current.policySource ?? 'global'}`) })),
            ),
            h(Field, {
              label: h('span', { className: 'dcm-label' }, h(Icon, { name: 'gauge', size: 12 }), t('capacity.title')),
              hint: t('capacity.default', { value: fmtTokens(current.defaultCapacity) }),
              control: h(
                'div',
                { className: 'dcm-stack', style: { gap: '7px' } },
                h(
                  'div',
                  { className: 'dcm-inline' },
                  h(NumberInput, {
                    label: t('capacity.title'),
                    value: draft?.capacity ?? null,
                    min: 4096,
                    step: 1024,
                    placeholder: fmtTokens(current.defaultCapacity ?? current.realCapacity),
                    onChange: (next) => patch('capacity', next),
                  }),
                  h('button', { type: 'button', className: 'dcm-chip', onClick: () => patch('capacity', null) }, t('capacity.useDefault')),
                ),
                h(
                  'div',
                  { className: 'dcm-chips' },
                  h('span', { className: 'dcm-hint' }, t('capacity.recommended')),
                  RECOMMENDED_CAPACITIES.map((entry) =>
                    h('button', {
                      key: entry.value,
                      type: 'button',
                      className: 'dcm-chip' + ((draft?.capacity ?? null) === entry.value ? ' dcm-chip-on' : ''),
                      onClick: () => patch('capacity', entry.value),
                    }, entry.label),
                  ),
                ),
                current.defaultCapacity
                  ? h(CapacitySlider, {
                      t,
                      max: current.defaultCapacity,
                      value: draft?.capacity ?? current.defaultCapacity,
                      step: 1000,
                      label: t('capacity.slider'),
                      onChange: (value) => patch('capacity', value),
                    })
                  : null,
              ),
            }),
            h(Field, {
              label: h('span', { className: 'dcm-label' }, h(Icon, { name: 'bolt', size: 12 }), t('field.threshold')),
              control: h(PercentSlider, { label: t('field.threshold'), min: 10, max: 95, value: thresholdPercent, onChange: (next) => patch('thresholdPercent', next) }),
            }),
            h(Field, {
              label: h('span', { className: 'dcm-label' }, h(Icon, { name: 'compare', size: 12 }), t('field.target')),
              control: h(PercentSlider, { label: t('field.target'), min: 5, max: 90, value: targetPercent, onChange: (next) => patch('targetPercent', next) }),
            }),
            h(Field, {
              label: h('span', { className: 'dcm-label' }, h(Icon, { name: 'shield', size: 12 }), t('field.protect')),
              control: h(PercentSlider, { label: t('field.protect'), min: 0, max: 80, value: protectPercent, onChange: (next) => patch('protectPercent', next) }),
            }),
            h(Field, {
              label: h('span', { className: 'dcm-label' }, h(Icon, { name: 'scissors', size: 12 }), t('field.strategy')),
              hint: t('strategy.hint'),
              control: h(
                'div',
                { className: 'dcm-strategies', role: 'radiogroup', 'aria-label': t('field.strategy') },
                STRATEGY_VALUES.map((entry) =>
                  h(
                    'button',
                    {
                      key: entry,
                      type: 'button',
                      role: 'radio',
                      'aria-checked': (draft?.strategy ?? 'summarize') === entry,
                      className: 'dcm-strategycard' + ((draft?.strategy ?? 'summarize') === entry ? ' dcm-strategycard-on' : ''),
                      onClick: () => patch('strategy', entry),
                    },
                    h('span', { className: 'dcm-strategyradio' + ((draft?.strategy ?? 'summarize') === entry ? ' dcm-strategyradio-on' : '') }),
                    h('span', null,
                      h('span', { className: 'dcm-strategy-title' }, t('strategy.' + entry + '.title')),
                      h('span', { className: 'dcm-strategy-desc' }, t('strategy.' + entry + '.desc')),
                    ),
                  ),
                ),
              ),
            }),
            actionError === undefined ? null : h(ErrorBox, { prefix: t('error.save') + ': ', error: actionError }),
            notice === undefined ? null : h('div', { className: 'dcm-notice' }, notice),
            buttons,
            gateHint,
            h('p', { className: 'dcm-hint', style: { margin: 0 } }, t('session.noteExpand')),
          ),
          h(
            'div',
            { className: 'dcm-stack' },
            biliVisible ? h(BiliStats, { t, sessionId }) : null,
            h('div', { className: 'dcm-card' },
              h(SectionTitle, { icon: 'compare', title: t('chart.beforeAfter') }),
              h(BeforeAfterChart, {
                records: records?.records ?? [],
                title: t('chart.beforeAfter'),
                beforeLabel: t('chart.before'),
                afterLabel: t('chart.after'),
                emptyLabel: t('chart.noRecords'),
              }),
            ),
            h('div', { className: 'dcm-card' },
              h(SectionTitle, { icon: 'chart', title: t('chart.breakdown') }),
              h(DonutChart, {
                totals: records?.totals?.breakdown ?? {},
                title: t('chart.breakdown'),
                centerLabel: t('chart.compressedTotal'),
                labelOf: (key) => t('cat.' + key),
                descOf: (key) => t('catDesc.' + key),
                emptyLabel: t('chart.noRecords'),
              }),
            ),
          ),
        ),
        dialog === null
          ? null
          : h(ConfirmDialog, {
              title: dialog.title,
              body: dialog.body,
              confirmLabel: dialog.confirmLabel,
              cancelLabel: t('common.cancel'),
              onCancel: closeDialog,
              onConfirm: () => {
                const action = dialog.onConfirm
                setDialog(null)
                action()
              },
            }),
      )
    }
    /* ── glyphs ──────────────────────────────────────────────────────────── */

    function Glyph(props) {
      const size = typeof props.size === 'number' ? props.size : 16
      return h(
        'svg',
        { width: size, height: size, viewBox: '0 0 64 64', 'aria-hidden': true, style: { display: 'block' } },
        h('circle', { cx: 32, cy: 32, r: 20, fill: 'none', stroke: 'currentColor', strokeWidth: 5, opacity: 0.35 }),
        h('path', { d: 'M32 12a20 20 0 0 1 17.3 10', fill: 'none', stroke: 'currentColor', strokeWidth: 5, strokeLinecap: 'round' }),
        h('rect', { x: 21, y: 24, width: 22, height: 4.5, rx: 2.25, fill: 'currentColor', opacity: 0.8 }),
        h('rect', { x: 21, y: 31.5, width: 15, height: 4.5, rx: 2.25, fill: 'currentColor', opacity: 0.55 }),
        h('rect', { x: 21, y: 39, width: 9, height: 4.5, rx: 2.25, fill: 'currentColor', opacity: 0.35 }),
      )
    }

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        const t = ctx.locale.bind(NS)
        ctx.effect(() => ctx.locale.register(NS, { en: EN, zh: ZH }), 'dsh-context-manager: dictionaries')
        ctx.effect(() => {
          const style = document.createElement('style')
          style.setAttribute('data-dsh-context-manager', '')
          style.textContent = CSS
          document.head.appendChild(style)
          return () => style.remove()
        }, 'dsh-context-manager: styles')

        ctx.slots.inject('main', () =>
          ctx.slots.register(
            { name: 'main', key: 'context-mgmt', locale: NS },
            function ContextManagementPage(props) {
              return h(ManagementPage, { ...props, t: props.t ?? t })
            },
          ),
        )

        ctx.slots.inject('sidebar.panellist', () =>
          ctx.slots.register(
            { name: 'sidebar.panellist', id: 'context-mgmt', order: 20, label: () => t('panel.title'), locale: NS },
            function ContextManagementPanelIcon(props) {
              return h(Glyph, { size: props.size })
            },
          ),
        )

        ctx.slots.inject('settings.section', () =>
          ctx.slots.register(
            { name: 'settings.section', id: 'context-compaction', order: 40, label: () => t('settings.section.title'), locale: NS },
            function ContextCompactionSettings(props) {
              return h(ManagementPage, { ...props, t: props.t ?? t })
            },
          ),
        )

        ctx.slots.inject('settings.section.icon', () =>
          ctx.slots.register(
            { name: 'settings.section.icon', id: 'context-compaction', locale: NS },
            function ContextCompactionSettingsIcon(props) {
              return h(Glyph, { size: props.size })
            },
          ),
        )

        ctx.slots.inject('conversation.view', () =>
          ctx.slots.register(
            { name: 'conversation.view', id: 'context-manager', order: 20, label: () => t('tab.session'), locale: NS },
            function ContextManagerSessionView(props) {
              return h(SessionView, { ...props, t: props.t ?? t })
            },
          ),
        )
      },
    }
  },
})
