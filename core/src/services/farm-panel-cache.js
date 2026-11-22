// 农场面板快照缓存（stale-serve）
// 概览页 / 背包页的读不再直接抢场景锁：worker 层在进场景前先 peek 这份缓存，
// 命中直接回包、不排队（自动化优先）。缓存只喂「本来就要发生」的读——
// 前端读未命中时回填、自动化 runFarmOperation 每次巡田顺手写入，不产生任何额外场景请求。
// 写操作后由 worker 失效对应分区，下次真实读回填；TTL 到期自然过期。
// 一个 worker 线程只服务一个账号，模块级 Map 天然按账号隔离。

const now = () => Date.now();
const PANEL_TTL_MS = { lands: 60000, bag: 60000, bagSeeds: 60000 };
const panelCache = new Map();

function cacheFarmPanel(key, data) {
    if (!data) return;
    panelCache.set(key, { at: now(), data });
}

function peekFarmPanel(key) {
    const hit = panelCache.get(key);
    if (!hit) return null;
    if (now() - hit.at > (PANEL_TTL_MS[key] ?? 60000)) {
        panelCache.delete(key);
        return null;
    }
    return hit.data;
}

// dropFarmPanel() 无参清空全部；传参则只清指定分区
function dropFarmPanel(...keys) {
    if (keys.length === 0) {
        panelCache.clear();
        return;
    }
    for (const k of keys) panelCache.delete(k);
}

module.exports = { cacheFarmPanel, peekFarmPanel, dropFarmPanel };
