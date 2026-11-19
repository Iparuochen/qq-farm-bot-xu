// 单元测试不做写请求节流（生产默认 300ms），否则每个用例都要真等。
process.env.RANCH_ACTION_GAP_MS = '0';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createRanchService } = require('../src/services/ranch');
const { createRanchSession } = require('../src/services/ranch-session');

/**
 * 面板快照缓存（stale-serve）：
 * worker 层在进场景前 peek 这份缓存，命中直接回包，概览页补刷不再抢场景锁。
 * 缓存只喂本来就要发生的牧场驻留（真读 / action 回包 / 自动化结束快照），
 * 这里验证：真读回填、peek 零 RPC、epoch 失效、TTL 过期、写操作作废其它分区、自动化回填。
 */
function fixture(options = {}) {
    const calls = [];
    const session = createRanchSession();
    const automation = { ranch_auto_collect: false, ranch_auto_clean: false };
    const ranch = { husbandry_type: 1, animal_count: 1, ranch_inst_id: '9007199254740993', capacity: 3, animals: [{ animal_id: '60001', animal_inst_id: 1, stage: 3, can_deliver: true, producing: false, can_harvest: false }], shelves: [{ slot_index: 0, can_collect: true, lots: [{ item_id: '2060001', remain_num: '2' }] }], hazards: [{ hazard_id: '888', hazard_type: 1 }] };
    const responses = {
        GetPlayerSceneInfo: { unlocked_scenes: [1, 2] },
        PlayerSceneLogin: {},
        AllCells: { grid_width: 10, grid_height: 10, facilities: [{ instance_id: ranch.ranch_inst_id, facility_id: 6001001, ranch }], building_items: [] },
        GetRanchDetail: { ranches: [ranch] },
        GetBag: { physical_items: [{ id: '60001', uid: '9999999999999999', count: '1', locked: true }], virtual_items: [{ id: '1007', count: '123' }] },
        GetBagTab: { tabs: [{ tab_id: '6', tab_name: '牧场幼崽' }] },
        GetOrderPanel: { panel: { slots: [] } },
        HarvestRanch: { op_results: [] }, CleanRanch: { op_results: [] }, TriggerProduce: { op_results: [] }, PlaceAnimal: { op_results: [] }, AddFeed: {}, SubmitOrder: {}, RefreshOrder: {},
    };
    const service = createRanchService({ getKnownFriendGids: () => [], ...options, session, getSettings: () => automation, getUserState: () => ({ gid: '12345' }), rpc: async (method, params) => {
        calls.push({ method, params });
        if (method === 'PlayerSceneLogin') return { global_scene_id: params.global_scene_id, server_time: '1794800000' };
        if (responses[method] instanceof Error) throw responses[method];
        return responses[method];
    } });
    return { service, calls, session, ranch, responses, automation };
}

test('panel cache: getStatus fills the cache and peekPanel serves it without any RPC', async () => {
    const f = fixture();
    const state = await f.service.getStatus();
    const callsAfterRead = f.calls.length;
    assert.equal(f.service.peekPanel('status'), state);
    assert.equal(f.calls.length, callsAfterRead);
});

test('panel cache: epoch change (relogin) invalidates everything', async () => {
    const f = fixture();
    await f.service.getStatus();
    assert.ok(f.service.peekPanel('status'));
    f.session.reset();
    assert.equal(f.service.peekPanel('status'), null);
});

test('panel cache: entries expire past their TTL', async () => {
    let t = 1_000_000;
    const f = fixture({ now: () => t });
    await f.service.getStatus();
    assert.ok(f.service.peekPanel('status'));
    t += 121_000;
    assert.equal(f.service.peekPanel('status'), null);
});

test('panel cache: getResource fills its own section and action keeps status fresh while dropping the rest', async () => {
    const f = fixture();
    // profile 依赖牧场经验物品（id 1102）计算等级。
    f.responses.GetBag.virtual_items.push({ id: '1102', count: '5000' });
    await f.service.getResource('profile');
    assert.ok(f.service.peekPanel('profile'));
    await f.service.action({ action: 'collect', ranchId: f.ranch.ranch_inst_id });
    // 写操作后 status 是 action 带回的最新快照，其余分区作废等待真实读回填。
    assert.ok(f.service.peekPanel('status'));
    assert.equal(f.service.peekPanel('profile'), null);
});

test('panel cache: an automation pass feeds the cache with its own snapshot', async () => {
    const f = fixture();
    f.automation.ranch_auto_collect = true;
    await f.service.runAutomation();
    assert.ok(f.service.peekPanel('status'));
});
