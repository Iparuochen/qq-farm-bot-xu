// Shared persistence/API/scheduler contract. Invalid legacy policies fail closed.
const SWITCHES = Object.freeze({
    autoClaimTasks: 'claimTask',
    autoCollect: 'collect', autoClean: 'clean', autoProduce: 'produce', autoHarvest: 'harvest', autoSubmitOrders: 'submitOrders', autoClaimIllustrated: 'claimIllustrated', autoClaimWeight: 'claimWeight',
    autoSteal: 'steal', autoHelp: 'help', autoStroke: 'stroke', autoPutHazard: 'putHazard', autoSell: 'sell', autoUseCan: 'useCan', autoAddFeed: 'addFeed', autoFriendFeed: 'friendFeed', autoPlace: 'place', autoBuy: 'buy', autoExchange: 'exchange', autoExchangePoop: 'exchangePoop', autoExchangePine: 'exchangePine', autoUpgradeRanch: 'upgradeRanch', autoUpgradeFacilities: 'upgradeFacilities', autoFeedAnimal: 'feedAnimal',
});
// 每日分享礼包 / 每日免费礼包对齐农场侧：没有开关、默认常驻执行，也不写入账号设置。
// 只作为自动化动作键使用（日志、动作校验），不出现在 SETTINGS_KEYS 里。
const ALWAYS_ON = Object.freeze({ autoClaimShare: true, autoClaimFreeGift: true });
const snake = v => v.replace(/[A-Z]/g, c => `_${c.toLowerCase()}`);
const SETTINGS_KEYS = Object.freeze(Object.fromEntries(Object.keys(SWITCHES).map(key => [key, `ranch_${snake(key)}`])));
const ACTION_SWITCH = Object.freeze({ ...Object.fromEntries(Object.entries(SWITCHES).map(([k, v]) => [v === 'submitOrders' ? 'submitOrder' : v, k])), friendProduce: 'autoSteal', claimDailyShare: 'autoClaimShare', claimFreeGift: 'autoClaimFreeGift' });
const LIMITS = Object.freeze({ farmMin: [2, 1, 3600], farmMax: [5, 1, 3600], helpMin: [10, 1, 3600], helpMax: [15, 1, 3600], smartSeconds: [300, 30, 3600], friendBatchSize: [5, 1, 50], maxActionsPerRun: [20, 1, 100], sellKeepCount: [20, 0, 999999], sellMaxPerRun: [10, 1, 99999], canReserveCount: [10, 0, 99999], canMaxPerRun: [1, 1, 99], bucketTargetSeconds: [86400, 3600, 2592000], feedReserveCount: [0, 0, 999999], feedTargetCount: [100, 1, 999999], feedThresholdPercent: [20, 0, 100], goldReserve: [10000, 0, 999999999], poopReserve: [100, 0, 999999999], pineReserve: [100, 0, 999999999] });
const LISTS = ['friendIncludeGids', 'friendExcludeGids', 'feedFriendGids', 'sellItemIds', 'canItemIds', 'cubItemIds'];
function normalizePolicy(value = {}, strict = false) {
    const result = {};
    const fail = message => { if (strict) throw new Error(`无效牧场策略：${message}`); };
    if (!value || typeof value !== 'object' || Array.isArray(value)) { fail('必须为对象'); value = {}; }
    const choices = { mode: ['legacy', 'simple'], husbandryStrategy: ['level', 'task', 'max_exp', 'max_profit', 'bag_priority'], husbandryFallbackStrategy: ['level', 'task', 'max_exp', 'max_profit'], canStrategy: ['none', 'both', 'normal', 'organic', 'smart', 'smart_only', 'smart_normal'] };
    const keys = new Set([...Object.keys(choices), 'quietEnabled', 'quietStart', 'quietEnd', 'feedFriendUseGold', 'addFeedUseGold', ...Object.keys(LIMITS), ...LISTS, 'buyRules', 'exchangeRules']);
    for (const [key, allowed] of Object.entries(choices)) {
        if (value[key] != null && !allowed.includes(value[key])) fail(key);
        result[key] = allowed.includes(value[key]) ? value[key] : allowed[0];
    }
    result.quietEnabled = value.quietEnabled === true;
    if (value.quietEnabled != null && typeof value.quietEnabled !== 'boolean') fail('quietEnabled');
    // 好友加草用金券补满（默认关闭）：开启后只对 feedFriendGids 白名单里的好友生效，仍受 goldReserve 保留量约束。
    if (value.feedFriendUseGold != null && typeof value.feedFriendUseGold !== 'boolean') fail('feedFriendUseGold');
    result.feedFriendUseGold = value.feedFriendUseGold === true;
    // 自己的牧草机金券兜底（默认关闭）：仓库牧草优先消耗，不足部分按 60 金券/单位补满，同样受 goldReserve 约束。
    if (value.addFeedUseGold != null && typeof value.addFeedUseGold !== 'boolean') fail('addFeedUseGold');
    result.addFeedUseGold = value.addFeedUseGold === true;
    for (const [key, fallback] of [['quietStart', '23:00'], ['quietEnd', '07:00']]) {
        if (value[key] != null && !/^([01]\d|2[0-3]):[0-5]\d$/.test(value[key])) fail(key);
        result[key] = /^([01]\d|2[0-3]):[0-5]\d$/.test(value[key]) ? value[key] : fallback;
    }
    for (const key of Object.keys(value)) if (!keys.has(key)) fail(`未知字段 ${key}`);
    for (const [key, [fallback, min, max]] of Object.entries(LIMITS)) {
        const v = value[key];
        if (v != null && (!Number.isSafeInteger(v) || v < min || v > max)) fail(key);
        result[key] = Number.isSafeInteger(v) && v >= min && v <= max ? v : fallback;
    }
    for (const key of LISTS) {
        const v = value[key] ?? [];
        if (!Array.isArray(v) || v.length > 200 || v.some(id => typeof id !== 'string' || !/^[1-9]\d{0,18}$/.test(id))) { fail(key); result[key] = []; }
        else result[key] = [...new Set(v)];
    }
    for (const key of ['buyRules', 'exchangeRules']) {
        const rows = value[key] ?? [];
        result[key] = [];
        if (!Array.isArray(rows) || rows.length > 30) { fail(key); continue; }
        for (const row of rows) {
            if (!row || typeof row !== 'object' || Object.keys(row).some(k => !['goodsId', 'targetStock', 'maxPerRun', 'maxUnitPrice', ...(key === 'exchangeRules' ? ['itemId', 'costItemId'] : [])].includes(k)) || typeof row.goodsId !== 'string' || !/^[1-9]\d{0,18}$/.test(row.goodsId) || !Number.isSafeInteger(row.targetStock) || row.targetStock < 1 || row.targetStock > 999999 || !Number.isSafeInteger(row.maxPerRun) || row.maxPerRun < 1 || row.maxPerRun > 99 || !Number.isSafeInteger(row.maxUnitPrice) || row.maxUnitPrice < 1 || row.maxUnitPrice > 999999999) { fail(key); continue; }
            if (key === 'exchangeRules' && (typeof row.itemId !== 'string' || !/^[1-9]\d{0,18}$/.test(row.itemId) || !['7002', '1008'].includes(row.costItemId))) { fail('兑换物品或货币未绑定'); continue; }
            if (result[key].some(r => r.goodsId === row.goodsId)) { fail('重复商品'); continue; }
            result[key].push({ goodsId: row.goodsId, targetStock: row.targetStock, maxPerRun: row.maxPerRun, maxUnitPrice: row.maxUnitPrice, ...(key === 'exchangeRules' ? { itemId: row.itemId, costItemId: row.costItemId } : {}) });
        }
    }
    if (result.farmMin > result.farmMax || result.helpMin > result.helpMax) { fail('最小间隔不可大于最大间隔'); result.farmMax = Math.max(result.farmMax, result.farmMin); result.helpMax = Math.max(result.helpMax, result.helpMin); }
    if (result.mode === 'simple') {
        const options = module.exports.getPolicyOptions();
        result.sellItemIds = options.sellItems.map(i => i.id);
        result.canItemIds = options.canItems.map(i => i.id);
        result.cubItemIds = options.cubItems.map(i => i.id);
        result.sellKeepCount = 0; result.sellMaxPerRun = 99999; result.canReserveCount = 0;
        // 牧草保留量由面板显式配置，简单模式不再清零；阈值模式的目标容量恒为 capacity。
        result.feedTargetCount = 999999;
        result.friendIncludeGids = []; result.friendExcludeGids = [];
        result.buyRules = []; result.exchangeRules = [];
    }
    return result;
}
const normalizeSettings = automation => Object.fromEntries(Object.entries(SETTINGS_KEYS).map(([key, stored]) => [key, automation?.[stored] === true]));
module.exports = { SETTINGS_KEYS, ACTION_SWITCH, ALWAYS_ON, LIMITS, normalizePolicy, normalizeSettings };
module.exports.getPolicyOptions = () => {
    const config = require('../gameConfig/RanchConfig.json');
    const shop = require('../gameConfig/RanchShopConfig.json');
    const names = new Map(config.MCItemInfo.map(i => [String(i.id), i.name]));
    const item = id => ({ id: String(id), name: names.get(String(id)) || `物品 ${id}` });
    return {
        sellItems: config.MCItemInfo.filter(i => [106, 107].includes(i.type) && /^1007:[1-9]\d*$/.test(String(i.sells)) && !i.sell_cond && !i.cond_sells).map(i => item(i.id)),
        canItems: config.MCCanConfig.map(i => item(i.id)),
        cubItems: config.MCAnimalConfig.filter(a => a.enable_flag === true).map(a => item(a.cub_item_id)),
        buyGoods: shop.MCGoods.filter(g => [5, 6].includes(g.shop_id) && g.price_id === 1007).map(g => ({ id: String(g.id), name: names.get(String(g.item_id)) || `商品 ${g.id}` })),
    };
};
