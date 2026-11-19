# 归档插件

活动结束后从 `core/plugins/` 移到这里。宿主**只自举** `core/plugins/*`（见
`core/src/plugins/host.js` 的 `bootstrapBuiltins`），所以本目录下的插件不会被安装或加载；
保留源码、proto、预构建前端与协议测试向量，供以后复用协议/回归测试。

归档流程：

1. `git mv core/plugins/<id> core/plugins-archive/<id>`；
2. 插件专属测试改指向 `../plugins-archive/<id>`（`milk-tea-activity`、`plugin-host`、
   `plugin-worker-host` 以奶茶插件作夹具）；
3. 在管理面板「活动插件」里卸载仍在运行的旧安装（`POST /api/plugins/<id>/uninstall`），
   否则实例里的 `data/plugins/installed/<id>` 会继续存在（活动窗口过期后不会展示，但会残留）；
4. 在下面登记归档原因与时间。

## 已归档

| 插件 | 活动 | 活动时间 | 归档时间 | 原因 |
|---|---|---|---|---|
| `milk-tea`（奶茶热销中，id 2026110100） | 10.15 — 11.16（含结算期） | 2026-11-16 结束 | 2026-11-18 | 活动过期下线；保留为插件宿主/协议回归测试夹具 |
