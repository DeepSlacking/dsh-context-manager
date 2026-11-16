# dsh-context-manager

中文 · [English](README.en.md)

DeepSeek Harness（DSH）插件：统一管理**上下文容量**与**压缩（compaction）策略**。

管理范围（三个层级，后者覆盖前者）：

| 层级 | 作用范围 | 可设置项 |
| --- | --- | --- |
| 全局默认 | 未指定模型/会话时使用 | 压缩执行引擎、压缩阈值、目标压缩阈值、会话保护范围、压缩策略、压缩使用的模型、自动压缩开关（**不再包含容量**） |
| 提供商/模型覆盖 | 使用该 provider + model 的所有会话 | 模型支持的最大值、自定义上下文容量、压缩阈值、目标压缩阈值、会话保护范围、压缩策略、压缩使用的模型、自动压缩开关 |
| 当前会话覆盖 | 仅当前会话 | 自定义上下文容量、压缩阈值、目标压缩阈值、会话保护范围、压缩策略 |

**上下文容量优先级**：当前会话自定义容量 ＞ 按提供商/模型设置的容量 ＞ **默认 = 该路由模型支持的最大值**
（模型支持最大值 = 模型覆盖里的同名字段；未填写时取该路由声明的窗口，例如 1M）。
推荐快捷值为 **128K / 256K / 512K / 1M**。

百分比的基准是**生效上下文容量**；绝对 Token 预算由容量与百分比换算（触发线 = 阈值百分比、目标线 = 目标压缩阈值百分比、保护 = 会话保护范围），压缩后用量回落到目标线，同时始终保留保护范围内的最近原文。

## 功能

- **策略接管**：插件在宿主平面提供自己的 `compaction` 引擎（继承官方 `BasicCompactionEngine`，复用其持久化事务与检查点格式），并在加载时关闭每个 Agent 预设里隔离挂载的官方压缩后端（gate 服务 + 预设声明 `inject` 等待 + Loader `internal/config` 重写），无需复制整份预设清单。
- **压缩执行引擎**（全局）：`auto`（默认，检测到 billion-context 时自动让位）/ `plugin`（始终由本插件执行）/ `off`（停用压缩，仅展示用量）。让位时本插件不自动也不手动压缩，会话内相关按钮置灰、API 返回 `context-manager/delegated`；`/compact` 命令提示由 bili 接管。
- **billion-context 接管与统计**：检测 bili 的 gate 服务、`BILLION_CONTEXT_NATIVE` 环境变量与 `__BILI_DSH_COMPACTION_VERDICT__`，并从 `BILLION_CONTEXT_PROXY` 或实例登记表定位运行中的代理；接管时展示 bili 自己的压缩统计（折叠块数、上下文/输入/缓存/输出 Token、缓存命中率、恢复次数，以及 cache report 折叠经济明细），数据实时来自代理的 `/__bili/stats`、`/__bili/cache-report`、`/__bili/plugin/manifest` 等回环接口，并提供「打开 bili 控制台」入口。本插件历史压缩记录继续保留并标注为“bili 接管前”。
- **四挡压缩策略**（UI 中每挡配简要说明）：
  - `summarize` 模型总结：压缩模型生成结构化检查点，信息最完整，调用一次模型；
  - `prune-first` 先裁剪后总结：先裁剪超大工具输出，仍达触发线再总结，更省 Token；
  - `prune-only` 仅裁剪：只裁剪工具输出、不生成总结，仍不够时停止并提示；
  - `truncate` 确定性截断：不调用模型，用简短说明替换较早对话，成本最低、细节丢失。
- **自定义上下文容量**：可扩展（不超过模型支持最大值）或收缩；收缩低于当前用量时二次确认，确认后按策略压缩再应用。
- **压缩使用的模型**：跟随当前模型 / 主模型 / 指定固定 provider+model。
- **立即压缩准入**：用量低于目标线时按钮置灰且服务端拒绝；目标线 ≤ 用量 < 触发线时按钮可用、点击后二次确认提示“未达触发线但已达目标线”；用量 ≥ 触发线时直接执行。
- **重置为默认**（会话内）：二次确认后清除会话覆盖；若当前用量高于默认容量，自动按策略压缩一次使其低于默认容量。
- **压缩图表（全局默认页 / 压缩记录页）**：支持 **今天 / 近 7 天 / 近 30 天 / 全部** 时间范围（默认近 7 天），五排布局：
  1. 会话数 · 压缩次数、总计释放 Token、平均每个会话释放 Token；
  2. 每次压缩前后对比；
  3. 被压缩内容类型环形图（分类与配色对齐上下文洞察插件的 Token 统计：系统提示词 / 用户消息 / 注入上下文 / 技能注入 / 助手消息 / 工具结果 / 其他）；
  4. 策略分布与总结模型分布并列，模型维度统计每次总结调用消耗的 Token；
  5. 压缩日志列表。
- **容量拖动条**：模型与会话的自定义容量在数字输入框之外提供滑杆，范围 **模型最大值 × 10% → 模型最大值**，步长 1000，拖动时输入框实时同步。
- **视觉**：`#F2F2F2` 浅灰页面底色、白色带阴影卡片、10px 统一间距；按提供商/模型以卡片网格呈现；各模块标题带对应图标；全站最小字号 14px。
- **`/compact` 命令**：预设官方命令被 gate 关闭后由本插件重新注册，按当前策略立即压缩。
- **界面入口**：侧边栏一级页面「Context management」、Settings 页面「Context & compaction」、会话内 View 标签「Context」、`/compact`。

## 目录

```
index.js            宿主插件：策略存储、JSON API、gate、宿主平面压缩引擎、/compact
backend.js          策略感知的压缩后端（BasicCompactionEngine 子类）
lib/policy.js       策略词汇、合并/校验、绝对预算换算、立即压缩准入、可压缩区间与内容分类
lib/aggregate.js    压缩记录的时间范围边界、过滤与聚合（纯函数）
lib/bili.js         billion-context 检测、代理 origin 发现、压缩统计适配（纯 Node 内置依赖）
lib/store.js        三作用域配置 + 压缩审计记录（原子写入、旧配置迁移安全）
client.js           浏览器插件：五个 slot 注册、卡片化 UI、图表、确认弹窗
cordis.patch.yml    bundle patch：插入宿主行 + 让 4 个预设声明等待 gate
locale/{en,zh}.json 插件管理器显示元数据
icon.svg            插件图标
```

## 安装

```
plugin_manager action=install_bundle target=D:\DSH-workspace\dsh-context-manager
```

gate 在加载时重写预设声明；已存在的 Agent 保留其启动时的组合，压缩后端接管、自动阈值、压缩模型选择对**安装后新建的会话**完整生效。已存在的会话仍可即时使用：手动压缩（受上述准入规则约束）、容量收缩/重置、以及宿主平面引擎对旧会话的“更早触发”自动压缩。

## 配置存储

`$DSH_HOME/storages/dsh-context-manager/policy.json`（原子写入；读取时自动丢弃旧版本字段，例如已移除的全局 `capacity`）。压缩审计记录最多保留 4000 条。

## JSON API

全部挂在 `/api/dsh-context-manager/*`（Connection 精确路由，仅 owner 浏览器 Cookie 可用，POST JSON）：

`state` / `catalog` / `policy` / `global` / `model` / `session` / `compact` / `records` / `bili` / `diagnostics`。

`state`、`session` 与 `diagnostics` 额外返回 `engine`：
`{mode:'auto'|'plugin'|'off', effective:'plugin'|'bili'|'off', bili:{detected, signals:{service,env,verdict}, origin, version, available, lastCheckedAt, error}}`。

`POST /bili` 接受 `{sessionId?, refresh?}`，返回 bili 压缩统计：`{available, engine, origin, dashboardUrl, version, sessions, totals, matchedSessionId, cacheReport, message?}`；
每个会话含 `blocks`、`contextTokens`、`inputTokens`、`cachedTokens`、`outputTokens`、`cacheHitPct`、`restores`、`lastSeen` 等字段。代理未运行或未启用时返回 `available:false` 与可读原因，不报错。

`POST /records` 接受 `{sessionId?, range?: 'today'|'7d'|'30d'|'all', limit?}`（默认 `all`，limit 默认 200）。返回
`{sessionId, range, since, until, records, totals}`；`totals` 覆盖整个筛选范围（不受 limit 影响）：
`count`、`sessions`、`freedTokens`、`avgFreedPerSession`、`summarizationTokens`、`breakdown`、
`strategies: {name:{count,freedTokens}}`、`models: {provider/model:{count,summarizationTokens}}`。
压缩记录新增 `summarizationUsage` / `summarizationTokens`（旧记录为 0）。

关键语义：

- `POST /compact`：低于目标线返回 `{ok:false,error:{code:'context-manager/below-target',…}}`；目标线 ≤ 用量 < 触发线且未确认时返回 `{ok:true,value:{needsConfirmation:true,reason:'between-target-and-threshold',…}}`；确认或已达触发线时执行并返回压缩前后数据与记录。压缩执行引擎为 `bili` 或 `off` 时返回 `context-manager/delegated` / `context-manager/disabled`。
- `POST /session` 支持 `{reset:true,confirm?}`：清除会话覆盖，需要时先确认（`reason:'reset-requires-compaction'`），确认后自动压缩使其低于默认容量。
- `getSessionState` 额外提供 `defaultCapacity` 与 `manualCompact`（`blocked` / `confirm` / `direct`）。

响应信封：`{ok:true,value}` 或 `{ok:false,error:{code,message}}`；错误信息附带 cause 链。

## 已知限制

- 浏览器内视觉验证需在已连接页面人工确认；自动化验证覆盖：宿主加载、gate 生效、策略/容量/准入/重置 API、客户端在 Node 桩环境中的 slot 注册与文案、bundle 进入浏览器 boot graph。
- 若路由经由第三方“压缩代理”（例如本机的 billion-context 代理），其服务端可能拒绝 `purpose: compaction` 的总结请求。此时请使用 `truncate` / `prune-first` / `prune-only` 策略，或把“压缩使用的模型”指定为直连模型（需要相应 API Key）。
- 上下文溢出恢复路径仍走官方兜底逻辑（可能生成总结），`/compact` 命令为显式人工操作、不受“立即压缩”准入规则限制。
- 总结模型 token 统计来自压缩时记录的 `compaction/summary` usage；本插件升级前产生的旧记录没有该数据，模型图为 0 并标注“无 token 记录”。
- 压缩目标按“保护范围 + 目标百分比”执行；若不可分割单元使目标不可达，记录保留实际结果并在日志告警。
- 策略存储为插件私有文件，不写入 profile 的 `cordis.patch.yml`。
- **不要同时让两套压缩器写同一份历史**：bili 压缩的是出站请求并保留客户端历史，本插件则提交会话压缩检查点；bili 官方也要求其激活时关闭 DSH 原生压缩。默认 `auto` 会在检测到 bili 时让位，但二者 bundle patch 都会改写预设 `inject`（Loader 按层替换），切换时应重新加载会话或重启 Harness；`plugin` 模式与 bili 并存属于强制行为，可能被 bili 拒绝总结请求。
- bili 的统计接口为内部 API（当前按 `billion-context@0.1.213` 适配），代理升级后字段可能变化；本插件按字段缺失降级展示，不影响压缩执行。
- 本次 bili 共存路径的验证范围：检测/发现/统计适配有单元测试（含模拟代理），引擎让位与 API 拒绝有实测；未在本机实测“真正启用 bili 并同时跑模型流量”的组合（会改变当前会话的模型路由），因此建议启用 bili 后重开会话观察一次，再决定保留哪套引擎。

## 许可

MIT License，Copyright (c) 2026 dsh-context-manager contributors。

本插件在 MIT 许可下自由使用、修改与分发；完整条款见 [LICENSE](LICENSE)。
