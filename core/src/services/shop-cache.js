/**
 * 商城目录缓存（worker 进程内）
 *
 * 种子/宠物/装扮/道具商城的商品、价格、限购都是官方静态配置，一天最多变一两次；
 * 前端每打开一次商城就现拉一遍网关既慢（首屏要等场景空闲）又白压请求。
 * 这里做 TTL 缓存 + 并发去重，登录后预热，购买后按前缀失效：
 * 只有「面板展示」读写缓存，自动化的买入/种植判断仍走真实请求，避免拿旧限购做决策。
 */
const DEFAULT_TTL_MS = 30 * 60 * 1000;

const entries = new Map();
const inflight = new Map();

function peek(key, ttl = DEFAULT_TTL_MS) {
    const hit = entries.get(key);
    if (!hit) return null;
    if (Date.now() - hit.at > ttl) return null;
    return hit.value ?? null;
}

async function remember(key, loader, { ttl = DEFAULT_TTL_MS, force = false } = {}) {
    if (!force) {
        const hit = peek(key, ttl);
        if (hit) return hit;
        const pending = inflight.get(key);
        if (pending) return pending;
    }
    const task = (async () => {
        const value = await loader();
        if (value != null) entries.set(key, { at: Date.now(), value });
        return value;
    })();
    inflight.set(key, task);
    try {
        return await task;
    } finally {
        if (inflight.get(key) === task) inflight.delete(key);
    }
}

function invalidate(prefix = '') {
    for (const key of [...entries.keys()]) if (!prefix || key.startsWith(prefix)) entries.delete(key);
}

function stats() {
    return [...entries.entries()].map(([key, row]) => ({ key, at: row.at, ageMs: Date.now() - row.at }));
}

module.exports = { DEFAULT_TTL_MS, peek, remember, invalidate, stats };
