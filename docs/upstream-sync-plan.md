# 上游同步计划（baseline 16260e7）

> 目标仓库：`qq-farm-bot-404-main`（本地 3007，自维护）
> 上游参考：`old-farmer-404/qq-farm-bot`（HEAD 5ac5024）
> 分叉基线：`16260e7b86f38e9eb8ca5523e55b2dd37db375f0`（2026-10-15，"害怕"）
> 生成时间：2026-11-17

## 〇、已拍板的决策（2026-11-17 23:23）

| 议题 | 决定 |
| --- | --- |
| 心跳/网关判据 | **完全用上游新版**，放弃本地 `shouldTerminateForHeartbeat`（3 次 miss + 30s 静默），改上游「`REQUEST_TIMEOUT` + 20s 无入站 → 立刻重连」+「60s 入站静默且有 pending → 兜底断开」。断开后的队列清理由本地保留。 |
| 奶茶活动 | 活动已下线，**代码与素材都不跟**（`5484f1c`、`885bec8` 全部跳过）。 |
| 节令小札 | 按本地插件化路线，**不跟上游 `e71d5ec`**（solar-terms 插件 + 自研面板继续自维护）。 |
| `LandLevelNeed.json` | **不需要同步**。已核实两边 120 条数据逐条一致，差异只是本地多一层 `{table,bundles,assetPaths,count,rows}` 导表包装；加载器已兼容两种格式。 |
| Web 前端 | **全站保持自研风格**，`web/**` 不取上游任何改动；服务端新能力（如 `batchFriend`）如要接，只改自研组件内部调用，视觉与布局不动。 |

## 一、现状结论

| 指标 | 上游 | 本地 3007 |
| --- | --- | --- |
| 基线以来提交 | 15 | 222 |
| 改动文件（基线→HEAD） | 1255（+49673 / -10910），其中新增 811 | 4013 |
| 与对方重叠的改动文件 | 70 | 70 |
| 仅一方改动 | 1185（上游） | — |

关键判断：

1. **牧场代码同源，不是两套实现。** `ranch-scheduler.js` / `ranch-strategy.js` / `ranch-protocol.js` / `ranch-visuals.js` / `RanchConfig.json` / `RanchAnimalIcons.json` / `RanchShopConfig.json` 全部 0 差异；`ranch.js` 差 112 行、`ranch-session.js` 差 12 行、`ranch-automation.js` 差 16 行。本地牧场相当于上游 11-17 早段快照，缺的是**后续三天的修补**（好友批量事务、好友列表缓存、超时取消语义）。
2. **心跳/网关是两套并行解法，已决定整体采纳上游新版。** 本地：`heartbeatMisses>=3 && 入站静默>30s` 才断开，`pending>5s` 记 request_stuck。上游：心跳超时且 20s 无入站流量即 `failConnection`，watchdog 以「入站静默 60s + 有 pending」为唯一判据。**决策（2026-11-17）：放弃本地判据，`network.js` / `gateway-health.js` / `request-priority.js` 以 39b8acd + e474228 + 72491b7 后的上游版本为准**，不再保留本地防误杀分支。
3. **素材绝不能覆盖。** 上游 `ranch_visuals/animals/60002/3.png` 哈希 `63d11d78…` 正是我们修复前的三角裂缝版本；本地已修复为 `9f8e0517…`。上游的 126 张牧场图全部保持旧渲染。
4. **本地牧场零测试。** `core/test` 104 个测试文件中与牧场相关的只有 `ranch-assets-in-plugin.test.js`；上游有 12 个牧场测试 + `warehouse-auto-sell` + `fixtures/ranch-official-codecs.json`，这是本次同步性价比最高的部分。
5. **Web 全站自研，不跟上游。** `RanchDashboard.vue` 本地 813 行（自研 UI）vs 上游 245 行；虽然 `RanchFriends.vue` 仅差 22 行、`stores/ranch.ts` / `RanchScene.vue` / `RanchShop.vue` 0 差异，但**决策（2026-11-17）：所有 `web/**` 保持本地自研版本，一律不取上游改动**。

## 二、15 个上游提交的价值判定

| 提交 | 日期 | 内容 | 改动/冲突文件 | 结论 |
| --- | --- | --- | --- | --- |
| `5484f1c` | 10-16 | 手机端奶茶活动页布局 | 1/1 | 跳过（活动已下线，不再维护） |
| `885bec8` | 10-16 | 我的工作页支持自动化选择 | 9/9 | 跳过（奶茶相关，活动已下线） |
| `778179e` | 10-16 | 修复 2x2 作物阶段图 | 20/11 | 按素材流程引入（走插件，不进 src） |
| `e71d5ec` | 10-16 | 节令小札页面优化 | 8/5 | 跳过（本地已插件化，solar-terms 插件 + 自研面板） |
| `54e8a60` | 10-16 | 启动时恢复默认抓包 | 1/1 | 已验证本地等价（`startEmbeddedCaptureService()`），无需改 |
| `8a5ed3f` | 10-16 | 兑换商店装扮图标补齐 | 35/5 | 仅取 34 张 png（无代码风险） |
| `39b8acd` | 10-20 | 心跳逻辑大改（network.js 288 行） | 14/10 | **整体采纳上游**（含测试） |
| `fda56ca` | 11-16 | 牧场实现（主体） | 763/377 | **不 cherry-pick**，本地已有 |
| `11d9114` | 11-17 | 牧场实现（续） | 479/16 | **不 cherry-pick**，本地已有 |
| `3d81583` | 11-17 | Dockerfile 换 node:24-alpine | 1/0 | 可选（部署相关） |
| `a7915aa` | 11-17 | 牧场好友列表 GetAll 失败回退 | 2/0 | **引入**（ranch.js + 测试） |
| `e474228` | 11-17 | 网关 watchdog 改入站静默判据 | 4/3 | **整体采纳上游** |
| `8d5634d` | 11-17 | 牧场自动化超时取消 | 5/1 | **引入**（ranch-automation + ranch.js alive） |
| `72491b7` | 11-17 | 心跳/牧场退避/请求优先级 | 10/4 | **整体采纳上游**（web 部分除外） |
| `5ac5024` | 11-17 | 好友列表磁盘缓存 + 强制刷新 + 批量事务 | 19/6 | **引入（重点）** |

## 三、执行计划

### P0 建基线与回滚点（前置）

1. 先清理工作区：当前有 297 个未提交改动（`core/plugins` 228、`core/src` 28、`web/src` 27 等），全部提交或 stash，再开同步分支。
2. `git switch -c sync/upstream-20261117`。
3. 把本地克隆的上游目录挂成 file remote，避免再受网络影响：
   ```
   git remote add upstream-local /c/Users/asin/Documents/qq-farm/qq-farm-bot-oldfarmer404
   git fetch upstream-local main
   ```
4. 打基线标签 `pre-upstream-sync`，方便整体回滚。

验收：`git status` 干净；`git tag` 有 `pre-upstream-sync`。

### P1 零冲突基础设施（纯新增文件，先落地）

直接取上游新文件，不碰任何本地已改文件：

- `core/src/services/local-friend-cache.js`（好友列表磁盘缓存，v8 序列化，按账号/玩家/场景隔离）
- `core/src/utils/business-pacing.js`
- `core/src/config/land-types.js`
- `core/test/local-friend-cache.test.js`、`core/test/business-pacing.test.js`
- 参考文档：`docs/ranch-*.md`（30+ 篇）、`core/docs/network-timeout-official-evidence.md`、`docs/account-scene-scheduler.md`
- 牧场离线工具链：`core/scripts/extract-ranch-visuals.cjs`、`extract-ranch-icons.cjs`、`extract-ranch-item-icons.cjs`、`inspect-ranch-har.cjs`、`verify-ranch-official-codecs.cjs`（正好补上本地缺的渲染脚本）

验收：新测试通过；`npm test` 无新增失败。

### P2 牧场服务增量（核心收益，中风险）

上游在这几个文件里的新增能力本地全缺：

1. `core/src/services/ranch.js`
   - `readFriends(force)` 接入 `local-friend-cache`（ranch-list 作用域）
   - `fetchFriends()`：`GetAll` 遇 `code=1000020` 时回退到已知 GID 走 `GetGameFriends`，其他错误照常抛出
   - `withFriendVisit(host, fn)` + `action({action:'batchFriend'})`：一次入场内完成多目标（偷/帮/摸/放蚊），最多 50 次，禁止嵌套和切换好友
   - **保留本地改动**：`sessionState: 'exclusive'` 注释、`queuedFarm/queuedRanch/enteredAt` 快照
2. `core/src/services/ranch-automation.js`
   - `alive` 改为可取消（`REQUEST_TIMEOUT` / `ENCODE_TIMEOUT` / `CONNECTION_CLOSED` / `SCENE_CANCELLED` 立即终止整轮）
   - 好友流程用 `withFriendVisit` 包裹
3. `core/src/services/ranch.js` 的自动化 `alive()` 加 `session.assertAllowed()` 早退（8d5634d）
4. `core/src/controllers/admin-ranch-routes.js`：`/api/ranch/:resource` 支持 `?refresh=true`
5. `core/src/runtime/data-provider.js` + `core/src/core/worker.js`：透传 refresh 与 batchFriend
6. `core/src/services/friend-api.js` + `friend-land-analyzer.js`：接入 `rawFriendCache` / `displayFriendCache`，失败改为抛出而不是返回 `[]`
7. 迁移 12 个牧场测试与 `core/test/fixtures/ranch-official-codecs.json`：`ranch.test.js`、`ranch-session.test.js`、`ranch-automation.test.js`、`ranch-access.test.js`、`ranch-scheduler.test.js`、`ranch-strategy.test.js`、`ranch-protocol.test.js`、`ranch-task-protocol.test.js`、`ranch-operation-log.test.js`、`ranch-visuals.test.js`、`ranch-item-icons.test.js`、`admin-ranch-routes.test.js`；另加 `warehouse-auto-sell.test.js`

验收：牧场 13 个测试全绿；`npm test` ≥ 485+新增；手工验证牧场好友「一键偷/帮/摸」只入场一次。

### P3 网络与网关（判据完全采用上游，断开接线保留本地）

**决策：心跳/网关判据不再保留本地分支，全部换成上游 39b8acd + e474228 + 72491b7 的版本。**
但 `network.js` 不能整份覆盖 —— 本地有上游没有的基础设施（请求优先级队列 `takeDispatchableRequest`/`drainRequestQueue`/`pendingClassCount`/`getGatewayLoad`、二段式登录 `usesPlayerSceneLogin`/`enterGameScene`/`fetchUserSettings`、`criticalLane` 通道），本地 1362 行 vs 上游 1135 行。所以按「判据换上游 / 接线留本地」的边界替换。

1. `core/src/utils/gateway-health.js` —— **整份替换为上游版**（纯函数模块，无本地依赖）
   - 新增：`NETWORK_TIMEOUT_MS=10000`、`CONNECTION_SILENCE_MS=60000`、`NETWORK_CHECK_INTERVAL_MS=1000`、`shouldTerminateGateway({inboundAgeMs, pendingCount})`、`canRunBackground()`
   - `evaluateGatewayHealth`：判据由 `heartbeatAgeMs > 30s` 改为 `heartbeatMisses > 0`；`oldestPendingAgeMs >= 5000` 保持 `request_stuck`
   - 删除：`shouldTerminateForHeartbeat`、`HEARTBEAT_STALE_AFTER_MS`、`MAX_HEARTBEAT_MISSES`
2. `core/src/utils/network.js`
   - `getGatewayHealth()`：入参改 `heartbeatMisses`，返回值补 `inboundAgeMs` / `heartbeatAgeMs` / `oldestPendingAgeMs`（上游 837-843 行形态）
   - 新增 `checkNetworkTimeout()`：`shouldTerminateGateway({inboundAgeMs, pendingCount})` → 断开，挂到 `networkScheduler.setIntervalTask('network_timeout_check', 1000)`
   - 心跳 catch：删掉 `shouldTerminateForHeartbeat` 分支，换成上游判据 ——
     `if (error.code === 'REQUEST_TIMEOUT' && now - lastInboundAt >= 20000) → 断开('heartbeat_timeout')`
   - **断开动作保留本地**：`networkEvents.emit('disconnect')` + `rejectAllPendingRequests()` + `rejectAllQueuedRequests()` + `ws.close()`（本地自研队列需要这套清理，上游的 `failConnection` 不含排队请求回收）
   - `lastInboundAt` 在任何入站帧刷新（本地已有，确认保留）
3. `core/src/core/worker.js`
   - `businessBackoff` 增加 `ranch` 维度（牧场自动任务按网关健康退避）
   - `handleApiCall` 统一 `runWithRequestPriority('foreground')`，`manual: true`
4. `core/src/utils/request-priority.js` / `auto-code-refresh.js` / `friend-operation-limits.js` 取 39b8acd 配套小改
5. 测试：`gateway-health.test.js`、`network-lifecycle.test.js`、`request-priority.test.js`、`auto-code-refresh.test.js` 一并取上游版

**已知副作用（上游语义，接受）**：心跳失败一次即 `heartbeat_missed` → 业务退避 30s 起（本地原来是 30s 才 stale）。比本地严格，但换来的是一次 `REQUEST_TIMEOUT` + 20s 无入站就立刻重连，恢复速度远快于本地约 90s。

### P4 Web 前端（决策：全站保持自研，不取上游改动）

**`web/**` 一律不引入上游提交**，视觉、布局、交互、组件结构全部沿用本地自研版本。上游 15 个提交中涉及 web 的（`5484f1c`、`885bec8`、`e71d5ec`、`72491b7` 的 RuntimeLogPanel 部分、`RanchDashboard.vue` 等）全部跳过。

唯一可选的例外（**仅在自研组件内部改调用，不换视觉**）：
- `views/RanchFriends.vue` 若 P2 上线了服务端 `batchFriend`，可把客户端循环 `runRanchFriendActions` 换成一次 `action({action:'batchFriend'})`，弹窗/卡片/布局一律不动；
- `composables/useRanchResource.ts` 若需要 `?refresh=true`，只在既有组合式函数里加参数透传。

不采纳时的后果：牧场好友批量仍走客户端循环，功能可用，只是入场次数多；后端能力保留，后续想接随时能接。

验收：`web/**` 与同步前逐字节一致（除上述可选改动）；`vue-tsc --noEmit` + `vite build` 通过。

### P5 素材与配置（按我方插件体系，不进 src）

1. `778179e` 的 2x2 作物高清阶段图（Crop_9005 / Plant_1028005 / Plant_1128005 / Plant_1129005）：先跑 `core/scripts/dedupe-seed-images.js`，再走 `pack-material-plugin.js` 增量超集，最后更新 `plant_images/manifest.json` 与 `milk-tea-phase-sources.json`
2. `8a5ed3f` 的 34 张 `web/public/activity/milk-tea/*.png` 直接拷（纯静态，无冲突）
3. `LandLevelNeed.json` —— **已核实，不需要同步**。这是官方「土地升级消耗表」（24 块地 × 升到 2~6 级，共 120 条 `land_id/level/level_need/items_need`）。两边 `rows` 内容 **逐条完全一致**（0 差异），文件大小差 1454 行纯粹是包装格式不同：本地是 `{table, bundles, assetPaths, count, rows}`（配置表导表格式），上游是裸数组。`gameConfig.js:169` 已用 `Array.isArray(raw) ? raw : raw.rows` 兼容两种格式，保持本地格式即可。
4. **明确不取**：上游 `ranch_visuals/**`（126 张仍是带裂缝的旧渲染）、上游所有 `web/**` 改动

验收：`ranch-assets-in-plugin.test.js` 仍绿；牧场动物图哈希与本地修复版一致。

### P6 回归与上线

1. `core`: `npm test` 全量（预期 485 + 约 60 新增）
2. `web`: `vue-tsc --noEmit` + `vite build`
3. 功能验收清单：农场收种/出售（含牧草保留）、牧场日常、牧场好友批量、牧场自动任务网关退避、断线重连、日志筛选
4. 灰度：先单账号跑 30 分钟，再全量；异常用 `pre-upstream-sync` 标签回滚

## 四、明确不引入

| 内容 | 原因 |
| --- | --- |
| `fda56ca` / `11d9114` 整包 | 本地已有同源牧场实现，761 个素材文件会覆盖我们的修复与插件结构 |
| 上游 `ranch_visuals/**` | 旧渲染带三角裂缝，本地已修 |
| 上游所有 `web/**` 改动 | 决策：前端全站保持自研（含 `RanchDashboard.vue` 813 行、`RanchFriends.vue`、日志面板、商店等） |
| 奶茶活动（`885bec8` / `5484f1c` 等） | 活动已下线，不再维护，代码也不跟 |
| 节令小札（`e71d5ec`） | 本地已插件化（solar-terms 插件 + 自研面板），上游页面优化不再跟进 |
| `3d81583` Dockerfile | 除非确定要升 node:24，否则不动部署基线 |
| `LandLevelNeed.json` | 数据与上游完全一致，仅包装格式不同，保持本地导表格式 |

## 五、风险

| 风险 | 影响 | 对策 |
| --- | --- | --- |
| 上游心跳判据更严格（miss 1 次即退避） | 网络抖动时后台任务暂停变多 | 上线后看 `gateway_missed` 退避频次；P3 单独分支，异常可整体回滚判据 |
| `network.js` 判据替换误伤本地队列 | 排队请求泄漏、重连后队列不 recovery | 只换判据、保留本地 `rejectAllPending/QueuedRequests` 清理；`network-lifecycle` 测试覆盖 |
| 好友批量事务与本地场景租约冲突 | 场景乒乓、请求被取消 | 复用本地 `exclusive()`，禁止嵌套入场；测试覆盖 |
| 牧场测试夹具与本地配置不匹配 | 测试红 | 先跑单文件，逐个改夹具 |
| 素材重复打包 | 插件体积膨胀、ID 错乱 | 先 dedupe，再增量超集，最后校验 manifest 引用 |
| 297 个未提交改动 | 同步冲突难以定位 | P0 先提交，保证每个阶段可独立回滚 |

## 六、执行结果（2026-11-17 已完成）

分支 `sync/upstream-20261117`，回滚标签 `pre-upstream-sync`（ranch-v2 @ `111af2fa`）。

| 阶段 | 状态 | 提交 | 说明 |
| --- | --- | --- | --- |
| P0 建基线 | 完成 | `111af2fa` | 298 个改动一次提交；`.gitignore` 补 `web/dist.old*`（192MB 旧构建不再入库）；清掉 11-16 残留的 `shallow.lock` |
| P1 零冲突新增 | 完成 | `a09004b1` | 3 个模块 + `LandTypes.json` + 5 个牧场脚本 + `lib/ranch-pose-renderer`（已移植裁剪外扩修复，重渲 60002 四帧哈希与修复版逐字节一致） |
| P2 牧场增量 | 完成 | `6307aafb` | `ranch.js` 全量对齐上游（仅保留 `sessionState='exclusive'`）；批量事务/好友磁盘缓存/超时取消/`?refresh=true` 全部到位 |
| P3 心跳网关 | 完成 | `d47ef85d` | `gateway-health.js` 整份换上游；判据换上游 + 60s 静默巡检 + 单调时钟 |
| P4 Web | 跳过 | — | 按决策全站保持自研 |
| P5 素材 | 跳过 | — | `778179e`（奶茶 2x2 作物）、`8a5ed3f`（奶茶装扮）都属已下线活动；`LandLevelNeed` 与线上 CDN 完全一致 |
| P6 回归 | 完成 | — | core 774/774；`vue-tsc --noEmit` 通过；`vite build` 成功 |

### 与计划不一致、需要知道的四点

1. **`ranch.js` 无法 cherry-pick。** 基线 `16260e7` 里根本没有这个文件——本地和上游都是基线之后各自新增的，所以做法是「取上游全文 + 恢复本地唯一差异 `sessionState='exclusive'`」，改完 `diff` 只剩这一处。
2. **上游有两条测试自相矛盾。** `ranch-access` 要求「带 `ranch_product` 的特殊产物不可售」，`ranch-automation` 要求「特殊产物可售」，上游 HEAD 这条用例本身就是红的（实测 21/22）。以 automation 为准，只断言锁定校验。
3. **`network-lifecycle.test.js` 未迁移。** 它白盒执行上游 `network.js` 的 `requestGate`/登录流程，本地是自研分班次队列 + 二段式登录（多发一次 `PlayerLogin`），18 例属结构性失败。判据本身由 `gateway-health.test.js`（5 例）覆盖。
4. **时间源改造。** `network.js` 19 处 `Date.now()` → `performance.now()`（仅连接代次 id 保留墙钟），与上游一致，避免系统时间被校准/改动时误判断线。

### 本地独有、同步后依然保留的能力

- 请求分班次队列（critical/foreground/farm/friend/background + 每班在途与排队配额）
- 二段式登录（PlayerLogin + 场景登录）、旧版 Login 检测与拒绝
- 好友黑名单模式（`getEffectiveFriendBlacklist` / `getFriendListMode`）
- 牧场 `sessionState='exclusive'` 与 snapshot 的 `queuedFarm` / `queuedRanch` / `enteredAt`
- 素材插件体系、茶饮/节令插件、自研 Web UI

### 仍未做

1. 牧场好友批量事务（`batchFriend`）后端已就绪，按决策前端未接，仍走客户端循环（功能可用，只是入场次数多）。
2. 服务未启动，运行时验收（掉线恢复、牧场批量、日志筛选）需要启动后手工过一遍。

### 农场侧 inFarm 全量包裹（已补齐）

上游不是零散包裹，是「scheduler 上下文隔离 + worker 显式包裹」两件套，本次成套移植：

- `core/src/services/scheduler.js`：整份取上游，新增 `createScheduler(ns, { scene })`、`invoke()`（定时器回调统一 `detached()` 脱离创建者租约，并按 `scene` 选项进 farm/ranch 租约）、`sceneEpoch`（登录重置后丢弃过期任务）。
- `core/src/core/worker.js`：`createScheduler('worker', { scene: 'farm' })`；`runFarmTick`/`runHelpTick`/`runStealTick` 分别以 `automation:farm|help|steal` 为 key 包 `inFarm`；`onReady` 整体 `detached(() => inFarm(...))`；`onFarmHarvested` 的 `sellAllFruits()` 与 `onDogSkillGiftPending` 同样包 `detached + inFarm`。
- 非农场任务显式 `{ scene: null }`：`unified_next_tick`（×2）、`status_sync`、`ranch_automation`、`ws_error_cleanup`、`kickout_stop`。
- 5 个农场侧调度器补默认场景：`capital-mode` / `fertilizer_buy` / `farm` / `friend` / `task`。
- 本地额外加固：`onReady` 末尾加 `.catch()`，避免 `connect()` 同步调用导致的未捕获 Promise 拒绝；`startDailyRoutineTimer()` 改用 `detached()` 发起，避免「登录租约关闭后 fire-and-forget 的每日例程被判为已取消」；`handleApiCall` 保留本地「读接口不打 manual」的细粒度区分。
- 新增 `core/test/scheduler-scene-lease.test.js`（3 例）：验证回调不继承已关闭租约、声明 scene 的定时器确实持有租约、`scene: null` 不占租约。

