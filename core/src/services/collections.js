/**
 * 藏品宝典（蓝晶藏品）
 * 移植自上游 muyuewang/qq-farm-bot-404 79c465f（collections.ts），
 * 协议：gamepb.collectionpb.CollectionService.GetCollections（category=1 蓝晶）。
 * 写操作：激活/升星（UpgradeCollection）、评分领奖（ClaimCollectionReward）、
 * 展示切换（SwitchSceneDisplay）。许愿及切换展台仍未开放。
 */

const fs = require('node:fs');
const { getItemById, getItemImageById } = require('../config/gameConfig');
const { getResourcePath } = require('../config/runtime-paths');

const CATEGORY = 1; // 蓝晶藏品
const DISPLAY_SLOT = 1; // 唯一藏品展示槽
let mutationTail = Promise.resolve();
const rarityNames = ['', '普通', '稀有', '珍品', '天工'];

// 本地 mutant/ 目录为命名文件（另加 18.png 数字文件），官方 icon 字段不完整，
// 显式维护 id → 文件名映射。id 13 喜鹊 hide_ui=true 不进目录。
const MUTANT_IMAGE_BY_ID = {
    1: 'frozen', 2: 'love', 3: 'dark', 4: 'moist', 5: 'golden',
    6: 'haha', 7: 'tata', 8: 'lotus', 9: 'moon', 10: 'mian',
    11: 'butterfly', 12: 'lightning', 14: 'crystal', 15: 'bichon',
    16: 'leyuan', 17: 'naicha', 18: '18',
};

let cache = null;

// 官方 series_icon 形如 gui/texture/mutant/icon/collect_1_1/spriteFrame，
// 本地图标按最后一级资源名存放在 mutant 目录下。
function seriesIconImage(icon) {
    const parts = String(icon || '').trim().split('/').filter(Boolean);
    if (parts.length === 0) return '';
    const name = parts.length > 1 && parts[parts.length - 1] === 'spriteFrame'
        ? parts[parts.length - 2]
        : parts[parts.length - 1];
    return name ? `/game-config/seed_images_named/mutant/${name}.png` : '';
}

/**
 * 藏品变异（MutantEffect 18）的系列信息。
 *
 * 服务端在阶段级变异记录里会带 collection_series_id / collection_item_id，但
 * 好友农场 Enter 回包并不总是下发（2026-11-11 抓取好友 1000120075 的地块确认
 * 只有 mutant_config_ids=[18]）。此时按 Configuration：CollectionGroup 说明的
 * 「藏品品质随作物品质而定」用作物品质（ItemInfo.rarity）反推系列。
 */
function getCollectionSeriesMeta(seriesId) {
    const id = Number(seriesId) || 0;
    if (!id) return null;
    const { seriesConfig } = ensureConfig();
    const row = (seriesConfig || []).find((item) => Number(item.series_id) === id);
    if (!row) return null;
    return {
        id,
        name: row.series_name || '',
        rarity: Number(row.series_rarity) || 0,
        rarityName: rarityNames[Number(row.series_rarity)] || '',
        image: seriesIconImage(row.series_icon),
    };
}

/** 作物品质 → 藏品系列（CollectionGroup：1 普通→1001、2 稀有→2001、3 珍品→3001、4 天工→4001） */
const COLLECTION_SERIES_BY_RARITY = { 1: 1001, 2: 2001, 3: 3001, 4: 4001 };

function getCollectionSeriesIdByRarity(rarity) {
    return COLLECTION_SERIES_BY_RARITY[Number(rarity) || 0] || 0;
}

/** 惰性加载藏品相关配置表（首次调用时读盘并缓存） */
function ensureConfig() {
    if (cache) return cache;
    const config = (name) => JSON.parse(fs.readFileSync(getResourcePath('gameConfig', 'collections', `${name}.json`), 'utf8'));
    cache = {
        seriesConfig: config('CollectionSeries'),
        itemConfig: config('CollectionItem'),
        starConfig: config('CollectionStarLevelNeed'),
        scoreConfig: config('CollectionScore'),
        rewardConfig: config('CollectionScoreReward'),
        conditionConfig: config('CollectionCondition'),
        pedestalConfig: config('CollectionPedestal'),
        groupConfig: config('CollectionGroup'),
        probabilities: config('MutantPublicity'),
        buffs: JSON.parse(fs.readFileSync(getResourcePath('gameConfig', 'BuffCfg.json'), 'utf8')),
        mutants: JSON.parse(fs.readFileSync(getResourcePath('gameConfig', 'MutantEffect.json'), 'utf8')),
    };
    return cache;
}

const quantity = (value) => (value == null ? '0' : String(value));

function rewards(value, collectionId) {
    if (!value) return [];
    return String(value).split(';').filter(Boolean).map((part) => {
        const [id, count] = part.split(':');
        const itemId = id === '0' ? collectionId : Number(id);
        return { itemId, count, name: getItemById(itemId)?.name || `物品${itemId}`, image: getItemImageById(itemId) };
    });
}

function conditionText(value) {
    if (!value) return [];
    const { seriesConfig, conditionConfig } = ensureConfig();
    return String(value).split(';').filter(Boolean).map((id) => {
        const condition = conditionConfig.find((row) => row.condition_id === Number(id));
        if (!condition) return '解锁条件待确认';
        const series = seriesConfig.find((row) => row.series_id === condition.target_series_id);
        if (condition.condition_type === 3) return `${series?.series_name || '指定系列'}中${condition.required_count}款藏品达到${condition.required_star_level}星`;
        return '解锁条件待确认';
    });
}

function buffDto(row) {
    const value = Number(row.attr_value) / 100;
    return {
        id: row.id, name: row.attr_id, value,
        description: row.attr_id === '节省10%肥料' ? `${value}%概率节省10%肥料` : `${row.attr_id} +${value}%`,
    };
}

function mutationRules(seriesId) {
    const { groupConfig } = ensureConfig();
    return groupConfig.filter((row) => row.series_id === seriesId)
        .sort((a, b) => a.display_order - b.display_order)
        .map((row) => ({ name: row.group_name, probability: Number((row.public_probability / 100).toFixed(1)), guarantee: row.display_guarantee }));
}

function conditionsMet(value, owned) {
    if (!value) return true;
    const { conditionConfig, itemConfig } = ensureConfig();
    return String(value).split(';').filter(Boolean).every((id) => {
        const condition = conditionConfig.find((row) => row.condition_id === Number(id));
        if (!condition || condition.condition_type !== 3) return false;
        const ids = itemConfig.filter((item) => item.series_id === condition.target_series_id).map((item) => String(item.item_id));
        return ids.filter((itemId) => Number(owned.get(itemId)?.star_level || 0) >= condition.required_star_level).length >= condition.required_count;
    });
}

function normalizeCollections(reply) {
    const {
        seriesConfig, itemConfig, starConfig, scoreConfig,
        rewardConfig, pedestalConfig, buffs,
    } = ensureConfig();
    const detail = (reply.details || []).find((row) => row.category === CATEGORY);
    if (!detail) throw new Error('当前账号未返回蓝晶藏品信息');
    const owned = new Map((detail.collections || []).map((row) => [quantity(row.collection_id), row]));
    const display = (reply.display_slots || []).find((row) => row.slot_type === DISPLAY_SLOT && row.display?.category === CATEGORY)?.display;
    const score = detail.current_score;
    const claimedScore = detail.claimed_reward_score;
    const series = seriesConfig.filter((row) => Number(row.category) === CATEGORY)
        .sort((a, b) => a.display_order - b.display_order).map((row) => {
            const items = itemConfig.filter((item) => item.series_id === row.series_id)
                .sort((a, b) => a.display_order - b.display_order).map((item) => {
                    const state = owned.get(String(item.item_id));
                    const starLevel = state?.star_level || 0;
                    const definition = getItemById(item.item_id);
                    const nextStar = starConfig.find((entry) => entry.series_id === row.series_id && entry.star_level === starLevel + 1);
                    const scores = scoreConfig.find((entry) => entry.star_level === starLevel && Number(entry.category) === CATEGORY);
                    const unlocked = conditionsMet(row.unlock_condition_ids, owned) && conditionsMet(item.unlock_condition_ids, owned);
                    const nextStarCosts = rewards(nextStar?.items_need || null, item.item_id);
                    const copiesNeeded = nextStarCosts.find((cost) => cost.itemId === item.item_id)?.count;
                    return {
                        id: item.item_id, name: definition?.name || `藏品${item.item_id}`, description: definition?.desc || '',
                        image: getItemImageById(item.item_id), starLevel, maxStarLevel: 5,
                        ownCount: quantity(state?.own_count), activated: starLevel > 0, isNew: state?.is_new === true,
                        score: scores ? Number(String(scores.score).split(';')[row.series_rarity - 1]) : 0,
                        displayed: display ? quantity(display.item_id) === String(item.item_id) : false,
                        wished: (detail.wished || []).some((wish) => quantity(wish.collection_id) === String(item.item_id)),
                        requirements: [...conditionText(row.unlock_condition_ids), ...conditionText(item.unlock_condition_ids)],
                        nextStarCosts, unlocked,
                        canUpgrade: unlocked && starLevel < 5 && !!copiesNeeded && BigInt(quantity(state?.own_count)) >= BigInt(copiesNeeded),
                    };
                });
            return {
                id: row.series_id, name: row.series_name, rarity: row.series_rarity, rarityName: rarityNames[row.series_rarity],
                description: row.desc || '', image: seriesIconImage(row.series_icon), requirements: conditionText(row.unlock_condition_ids), mutationRules: mutationRules(row.series_id), items,
                activatedCount: items.filter((item) => item.activated).length, totalCount: items.length,
            };
        });
    const milestones = rewardConfig.filter((row) => Number(row.category) === CATEGORY)
        .sort((a, b) => a.score - b.score).map((row) => ({
            level: row.level, score: row.score, claimed: row.score <= claimedScore, reached: row.score <= score,
            rewards: rewards(row.rewards), buffs: buffs.filter((buff) => buff.source_type === '藏品属性' && Number(buff.source_param) === row.level).map(buffDto),
        }));
    const currentBuffs = new Map();
    for (const milestone of milestones.filter((row) => row.claimed)) {
        for (const buff of milestone.buffs) currentBuffs.set(buff.name, buff);
    }
    return {
        category: CATEGORY, score, claimedScore,
        activatedCount: series.reduce((sum, row) => sum + row.activatedCount, 0),
        totalCount: series.reduce((sum, row) => sum + row.totalCount, 0),
        nextRewardScore: milestones.find((row) => !row.claimed)?.score ?? null,
        currentBuffs: [...currentBuffs.values()], milestones, series,
        display: display && Number(display.item_id) > 0 ? { itemId: quantity(display.item_id), pedestalId: quantity(display.pedestal_id) } : null,
        pedestals: pedestalConfig.filter((row) => Number(row.category) === CATEGORY).map((row) => ({
            id: row.pedestal_id, name: getItemById(row.pedestal_id)?.name || '展台', image: getItemImageById(row.pedestal_id),
            owned: row.is_default === 1 || (detail.pedestals || []).some((item) => quantity(item.pedestal_id) === String(row.pedestal_id)),
        })),
        updatedAt: Date.now(),
    };
}

let pendingSnapshot = null;

async function readCollectionsReply() {
    const { sendMsgAsync } = require('../utils/network');
    const { types } = require('../utils/proto');
    const body = types.GetCollectionsRequest.encode(types.GetCollectionsRequest.create({ categories: [CATEGORY] })).finish();
    const reply = await sendMsgAsync('gamepb.collectionpb.CollectionService', 'GetCollections', body);
    return types.GetCollectionsReply.decode(reply.body);
}

function getCollectionsSnapshot(options = {}) {
    if (options.fresh) return readCollectionsReply().then(normalizeCollections);
    if (pendingSnapshot) return pendingSnapshot;
    const request = readCollectionsReply().then(normalizeCollections);
    pendingSnapshot = request;
    request.finally(() => { if (pendingSnapshot === request) pendingSnapshot = null; }).catch(() => {});
    return request;
}

function collectionError(code, message) {
    return Object.assign(new Error(message), { code });
}

function collectionId(value) {
    const id = Number(value);
    if (!Number.isSafeInteger(id) || !ensureConfig().itemConfig.some((item) => item.item_id === id)) {
        throw collectionError('INVALID_ARGUMENT', '藏品编号无效');
    }
    return id;
}

function costSignature(costs) {
    return costs.map((cost) => `${cost?.itemId}:${cost?.count}`).sort().join('|');
}

async function bagBalance(itemId) {
    const warehouse = require('./warehouse');
    const bag = await warehouse.getBag();
    let total = 0n;
    for (const item of warehouse.getBagItems(bag).filter((entry) => Number(entry.id) === itemId)) {
        const count = BigInt(quantity(item.count));
        if (count < 0n) throw collectionError('BALANCE_UNKNOWN', '物品余额无法确认');
        total += count;
    }
    return { resourceKey: `item:${itemId}`, state: 'known', total: String(total), locked: '0' };
}

async function prepareCollectionUpgrade(input = {}) {
    const id = collectionId(input.collectionId);
    const level = input.expectedStarLevel;
    if (!Number.isInteger(level) || level < 0 || level >= 5) throw collectionError('INVALID_ARGUMENT', '请提供当前藏品星级（0–4）');
    const raw = await readCollectionsReply();
    const snapshot = normalizeCollections(raw);
    const item = snapshot.series.flatMap((series) => series.items).find((entry) => entry.id === id);
    if (!item) throw collectionError('COLLECTION_STATE_CHANGED', '藏品数据缺失，请刷新后重试');
    if (item.starLevel !== level) throw collectionError('COLLECTION_STATE_CHANGED', '藏品星级已变化，请刷新后重新确认');
    if (!item.unlocked) throw collectionError('COLLECTION_LOCKED', '尚未满足藏品解锁条件');
    if (!item.nextStarCosts.length) throw collectionError('COLLECTION_COST_UNKNOWN', '升星材料无法确认');
    if (input.expectedCosts !== undefined && (!Array.isArray(input.expectedCosts) || costSignature(input.expectedCosts) !== costSignature(item.nextStarCosts))) {
        throw collectionError('PRICE_CHANGED', '激活或升星材料已变化，请重新确认');
    }
    const balances = [];
    for (const cost of item.nextStarCosts) {
        const balance = cost.itemId === id
            ? { resourceKey: `item:${id}`, state: 'known', total: item.ownCount, locked: '0' }
            : await bagBalance(cost.itemId);
        if (BigInt(balance.total) - BigInt(balance.locked) < BigInt(cost.count)) {
            throw collectionError('INSUFFICIENT_BALANCE', `${cost.name}不足，需要 ${cost.count}`);
        }
        balances.push(balance);
    }
    return {
        raw, snapshot, item, balances,
        costs: item.nextStarCosts.map((cost) => ({ resourceKey: `item:${cost.itemId}`, amount: cost.count })),
        expected: { starLevel: level, costs: item.nextStarCosts.map((cost) => ({ itemId: cost.itemId, count: cost.count })) },
    };
}

async function sendCollectionMutation(method, input) {
    const { types } = require('../utils/proto');
    const { sendMsgAsync } = require('../utils/network');
    pendingSnapshot = null;
    const body = types[`${method}Request`].encode(input).finish();
    const reply = await sendMsgAsync('gamepb.collectionpb.CollectionService', method, body);
    return types[`${method}Reply`].decode(reply.body);
}

function unconfirmed() {
    throw collectionError('COLLECTION_RESULT_UNKNOWN', '藏品操作结果无法确认，请刷新核对，不要重复提交');
}

function serializeMutation(operation) {
    const result = mutationTail.then(operation, operation);
    mutationTail = result.then(() => undefined, () => undefined);
    return result;
}

async function upgradeCollection(input = {}) {
    return serializeMutation(async () => {
        const plan = await prepareCollectionUpgrade(input);
        const reply = await sendCollectionMutation('UpgradeCollection', { category: CATEGORY, collection_id: plan.item.id });
        const copies = plan.item.nextStarCosts.find((cost) => cost.itemId === plan.item.id);
        if (!copies) throw collectionError('COLLECTION_COST_UNKNOWN', '升星材料无法确认');
        const expectedCount = BigInt(plan.item.ownCount) - BigInt(copies.count);
        if (reply.category !== CATEGORY
            || Number(reply.collection_id) !== plan.item.id
            || reply.star_level !== plan.item.starLevel + 1
            || BigInt(quantity(reply.own_count)) !== expectedCount) {
            unconfirmed();
        }
        const series = plan.snapshot.series.find((entry) => entry.items.some((item) => item.id === plan.item.id));
        const { scoreConfig } = ensureConfig();
        const score = scoreConfig.find((row) => Number(row.category) === CATEGORY && row.star_level === reply.star_level);
        if (!score || reply.current_score !== plan.snapshot.score - plan.item.score + Number(String(score.score).split(';')[series.rarity - 1])) unconfirmed();
        for (const cost of plan.item.nextStarCosts.filter((entry) => entry.itemId !== plan.item.id)) {
            const before = plan.balances.find((balance) => balance.resourceKey === `item:${cost.itemId}`);
            const after = await bagBalance(cost.itemId);
            if (BigInt(after.total) !== BigInt(before.total) - BigInt(cost.count)) unconfirmed();
        }
        const detail = plan.raw.details.find((entry) => entry.category === CATEGORY);
        detail.collections = detail.collections || [];
        let owned = detail.collections.find((entry) => Number(entry.collection_id) === plan.item.id);
        if (!owned) {
            owned = { collection_id: plan.item.id };
            detail.collections.push(owned);
        }
        Object.assign(owned, { star_level: reply.star_level, own_count: reply.own_count });
        detail.current_score = reply.current_score;
        return { snapshot: normalizeCollections(plan.raw), costs: plan.costs };
    });
}

async function claimCollectionRewards() {
    return serializeMutation(async () => {
        const raw = await readCollectionsReply();
        const snapshot = normalizeCollections(raw);
        const eligible = snapshot.milestones.filter((row) => row.reached && !row.claimed);
        if (!eligible.length) return { snapshot, skipped: true };
        const reply = await sendCollectionMutation('ClaimCollectionReward', { category: CATEGORY });
        if (reply.current_score < snapshot.score || reply.claimed_reward_score < eligible.at(-1).score || reply.claimed_reward_score > reply.current_score) unconfirmed();
        const detail = raw.details.find((entry) => entry.category === CATEGORY);
        Object.assign(detail, { current_score: reply.current_score, claimed_reward_score: reply.claimed_reward_score });
        return {
            snapshot: normalizeCollections(raw),
            claimedScores: reply.claimed_scores,
            rewards: (reply.total_rewards || []).map((item) => ({
                id: Number(item.id), name: getItemById(Number(item.id))?.name || `物品${item.id}`, count: quantity(item.count),
            })),
        };
    });
}

async function setCollectionDisplay(input = {}) {
    const id = collectionId(input.collectionId);
    if (typeof input.displayed !== 'boolean') throw collectionError('INVALID_ARGUMENT', '请指定展示或取消展示');
    return serializeMutation(async () => {
        const raw = await readCollectionsReply();
        const snapshot = normalizeCollections(raw);
        const item = snapshot.series.flatMap((series) => series.items).find((entry) => entry.id === id);
        if (!item || !item.activated) throw collectionError('COLLECTION_NOT_ACTIVE', '请先激活藏品');
        const current = snapshot.display?.itemId || '0';
        if (input.expectedDisplayItemId !== undefined && String(input.expectedDisplayItemId) !== current) throw collectionError('COLLECTION_STATE_CHANGED', '展示藏品已变化，请刷新后重新确认');
        if ((input.displayed && current === String(id)) || (!input.displayed && current !== String(id))) return { snapshot, skipped: true };
        const target = input.displayed ? id : 0;
        const reply = await sendCollectionMutation('SwitchSceneDisplay', {
            display_slot: { slot_type: DISPLAY_SLOT, display: { category: CATEGORY, item_id: target } },
        });
        const slot = reply.display_slot;
        if (slot?.slot_type !== DISPLAY_SLOT || slot.display?.category !== CATEGORY || Number(slot.display.item_id) !== target) unconfirmed();
        raw.display_slots = [...(raw.display_slots || []).filter((row) => row.slot_type !== DISPLAY_SLOT), slot];
        return { snapshot: normalizeCollections(raw) };
    });
}

function operateCollections(action, input = {}) {
    if (action === 'upgrade') return upgradeCollection(input);
    if (action === 'claim') return claimCollectionRewards();
    if (action === 'display') return setCollectionDisplay(input);
    throw collectionError('INVALID_ARGUMENT', '未知的藏品操作');
}

function getMutationCatalog() {
    const { mutants, probabilities, seriesConfig, itemConfig } = ensureConfig();
    const effects = mutants.filter((row) => !row.hide_ui).sort((a, b) => (a.sort || 0) - (b.sort || 0)).map((row) => {
        const [action, value] = String(row.actions || '').split(':').map(Number);
        const effect = action === 2 ? `数量 ×${value}` : action === 3 ? `售价 ×${value}` : action === 4 ? `产出 ${row.fruit_name}` : '';
        const imageName = MUTANT_IMAGE_BY_ID[row.id];
        return {
            id: row.id, name: row.effect_name, tag: row.tag,
            image: imageName ? `/game-config/seed_images_named/mutant/${imageName}.png` : '',
            effect, description: row.tips || '',
            probabilities: probabilities.filter((entry) => entry.mutant_id === row.id)
                .map((entry) => ({ rarity: entry.rarity, percent: entry.public_probability / 100 })),
        };
    });
    return {
        normal: effects.filter((row) => row.tag === '无'),
        decoration: effects.filter((row) => row.tag === '装扮'),
        collections: seriesConfig.filter((row) => Number(row.category) === CATEGORY && !row.display)
            .sort((a, b) => a.display_order - b.display_order).map((row) => ({
                id: row.series_id, name: row.series_name, rarityName: rarityNames[row.series_rarity], description: row.desc, mutationRules: mutationRules(row.series_id),
                image: seriesIconImage(row.series_icon),
                items: itemConfig.filter((item) => item.series_id === row.series_id)
                    .sort((a, b) => a.display_order - b.display_order).map((item) => ({
                        id: item.item_id, name: getItemById(item.item_id)?.name || `藏品${item.item_id}`, image: getItemImageById(item.item_id),
                    })),
            })),
    };
}

module.exports = {
    getCollectionsSnapshot, normalizeCollections, getMutationCatalog,
    prepareCollectionUpgrade, upgradeCollection, claimCollectionRewards, setCollectionDisplay, operateCollections,
    getCollectionSeriesMeta, getCollectionSeriesIdByRarity,
};
