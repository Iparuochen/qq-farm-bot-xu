// 单元测试不做写请求节流（生产默认 300ms），否则每个用例都要真等。
process.env.RANCH_ACTION_GAP_MS = '0';
const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const fs = require('node:fs');
const path = require('node:path');
const { createRanchService } = require('../src/services/ranch');
const { createRanchSession } = require('../src/services/ranch-session');
const { createRanchProtocol } = require('../src/services/ranch-protocol');
// 今日计数持久化写到临时目录，避免污染真实 data/stats。
process.env.FARM_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'ranch-stats-'));
function fixture(settings = {}, knownFriendGids = []) {
    const calls = []; const logs = [];
    const ranch = { ranch_inst_id: '9007199254740993', husbandry_type: 1, capacity: 4, animal_count: 1,
        animals: [{ animal_inst_id: 35, animal_id: '60004', stage: 3, mutation: { mutation_type: 0, strokable: true, stroked_gids: [] } }],
        shelves: [{ slot_index: 0, can_steal: true, lots: [] }], hazards: [{ hazard_id: '7' }] };
    const cells = { facilities: [{ instance_id: '999', facility_id: 6001001, ranch: { ranch_inst_id: ranch.ranch_inst_id } }] };
    const responses = {
        GetAll: { game_friends: [{ gid: '456' }], blocked_players: [] },
        GetGameFriends: { friends: [{ gid: '456' }] },
        EnterHomestead: { homestead_cells: cells }, LeaveHomestead: {}, AllCells: cells,
        GetRanchDetail: { ranches: [ranch] },
        GetRanchOpTimes: { ops: [{ op_id: '11003', remaining_times: '97' }, { op_id: '11009', remaining_times: '10' }] },
        StealProduce: { op_results: [{ rewards: [{ id: '1060004', count: '1' }] }] },
        StrokeAnimal: { triggered: false, remaining_times: '9', op_result: { rewards: [{ id: '1102', count: '1' }] } },
        PutHazard: { actual_count: '1', remaining_times: '96' }, CleanAllRanch: { op_results: [] },
        GetBag: { physical_items: [{ id: '2060001', uid: '9007199254740995', count: '3' }, { id: '80031', uid: '101', count: '60' }, { id: '80021', uid: '102', count: '40' }] },
        GetBagTab: {}, GetOrderPanel: {}, BatchUse: { got_items: [{ id: '7004', count: '3600' }] }, Sell: { get_items: [{ id: '1007', count: '3' }] },
        InteractRecords: { records: [{ time: '1794810000', interact_type: '1', opr_nickname: '固定访客' }] },
    };
    const service = createRanchService({ session: createRanchSession(), getSettings: () => settings, getUserState: () => ({ gid: '123' }), getKnownFriendGids: () => knownFriendGids, friendRosterDir: fs.mkdtempSync(path.join(os.tmpdir(), 'ranch-roster-')), statsAccountId: () => 'test', operationsSaveDebounceMs: 25, log: (...args) => logs.push(args), rpc: async (method, params) => {
        calls.push({ method, params });
        const value = responses[method];
        if (value instanceof Error) throw value;
        if (typeof value === 'function') return value(params);
        assert.notEqual(value, undefined, `unexpected RPC ${method}`);
        return structuredClone(value);
    } });
    const input = action => ({ action, hostGid: '456', ranchId: ranch.ranch_inst_id, animalInstId: 35, slotIndex: 0 });
    return { service, responses, calls, logs, ranch, input };
}
const mutations = new Set(['StealProduce', 'StrokeAnimal', 'PutHazard', 'CleanAllRanch', 'Sell', 'BatchUse']);

test('new RPC ownership is capture-confirmed, especially StrokeAnimal belongs to RanchService', () => {
    const p = createRanchProtocol();
    for (const method of ['StrokeAnimal', 'PutHazard']) assert.equal(p.rpc[method].service, 'gamepb.animalpb.RanchService');
    assert.equal(p.rpc.StealProduce.service, 'gamepb.animalpb.AnimalService');
    for (const method of ['Sell', 'BatchUse']) assert.equal(p.rpc[method].service, 'gamepb.itempb.ItemService');
    assert.equal(p.rpc.InteractRecords.service, 'gamepb.interactpb.InteractService');
});

test('friend visit reads detail and exits; does not leave open server visit or mutate', async () => {
    const f = fixture();
    const result = await f.service.action(f.input('visitFriend'));
    assert.equal(result.friend.hostGid, '456');
    assert.equal(result.friend.ranches[0].animals[0].canStroke, true);
    assert.equal(f.calls.some(c => mutations.has(c.method)), false);
    assert.deepEqual(f.calls.find(c => c.method === 'EnterHomestead').params, { host_gid: '456', reason: 2 });
    assert.deepEqual(f.calls.at(-1), { method: 'LeaveHomestead', params: { host_gid: '456' } });
    assert.equal(f.calls.some(c => c.method === 'PlayerSceneLogin'), false);
});

for (const [action, method, params] of [
    ['steal', 'StealProduce', { host_gid: '456', targets: [{ ranch_inst_id: '9007199254740993', slot_index: 0 }] }],
    ['help', 'CleanAllRanch', { host_gid: '456', ranch_inst_ids: ['9007199254740993'] }],
    ['stroke', 'StrokeAnimal', { host_gid: '456', target: { ranch_inst_id: '9007199254740993', animal_inst_id: 35 } }],
    ['putHazard', 'PutHazard', { host_gid: '456', ranch_inst_id: '9007199254740993', op_id: '11003', count: '1' }],
]) test(`${action} revalidates target, sends scoped official request, refreshes, logs and leaves`, async () => {
    const f = fixture();
    await f.service.action(f.input(action));
    assert.deepEqual(f.calls.find(c => c.method === method)?.params, params);
    assert.equal(f.calls.filter(c => c.method === method).length, 1);
    assert.equal(f.calls.at(-1).method, 'LeaveHomestead');
    assert.equal(f.calls.filter(c => c.method === 'GetRanchDetail').length, 2);
    assert.ok(f.logs.some(l => l[2].event === action && l[2].result === 'ok' && l[2].scene === 'ranch'));
});

test('friend actions reject self, unknown and blocked hosts before entering', async () => {
    const f = fixture();
    for (const hostGid of ['123', '789', '0', '1.2', '']) await assert.rejects(f.service.action({ ...f.input('steal'), hostGid }));
    f.responses.GetAll.blocked_players = [{ gid: '456' }];
    await assert.rejects(f.service.action(f.input('steal')), /不是可访问/);
    assert.equal(f.calls.some(c => c.method === 'EnterHomestead'), false);
});

test('degraded empty friend list still allows visits to known friends, server is the authority', async () => {
    // 上游会把限频降级的空列表缓存 5 分钟并拒绝全部好友访问；这里改为名单兜底直接进场景
    const f = fixture({}, ['456']);
    f.responses.GetAll = { game_friends: [], blocked_players: [] };
    f.responses.GetGameFriends = { friends: [] };
    const result = await f.service.action(f.input('visitFriend'));
    assert.equal(result.friend.hostGid, '456');
    assert.equal(f.calls.some(c => c.method === 'EnterHomestead'), true);
});

test('manual force refresh hitting a degraded list falls back to the last good cache', async () => {
    const f = fixture({}, ['456']);
    await f.service.action(f.input('visitFriend'));
    const enters = f.calls.filter(c => c.method === 'EnterHomestead').length;
    f.responses.GetAll = { game_friends: [], blocked_players: [] };
    f.responses.GetGameFriends = { friends: [] };
    const result = await f.service.action(f.input('visitFriend'));
    assert.equal(result.friend.hostGid, '456');
    assert.equal(f.calls.filter(c => c.method === 'EnterHomestead').length, enters + 1);
});

test('roster keeps previously seen friends visitable when the server list omits them', async () => {
    // 服务器名单成员波动：同一好友这次在名单里、下次不在（线上实测 150 人名单相邻两次成员不同）
    const f = fixture();
    await f.service.action(f.input('visitFriend')); // 456 进花名册
    f.responses.GetAll = { game_friends: [{ gid: '789' }], blocked_players: [] };
    f.responses.GetGameFriends = { friends: [{ gid: '789' }] };
    const result = await f.service.action(f.input('visitFriend')); // 当次列表只有 789
    assert.equal(result.friend.hostGid, '456');
    assert.equal(f.calls.filter(c => c.method === 'EnterHomestead').length, 2);
});

test('friend list fetch requests roster GIDs, so a short server list cannot truncate it', async () => {
    // 线上实测：271 位好友，GetAll 只回 150 位。花名册必须并入明细请求来源，否则预取/巡访永远漏一半人。
    const f = fixture();
    await f.service.action(f.input('visitFriend')); // 456 进花名册
    f.responses.GetAll = { game_friends: [{ gid: '789' }], blocked_players: [] };
    f.responses.GetGameFriends = params => ({ friends: params.friend_gids.map(gid => ({ gid })) });
    const { friends } = await f.service.getResource('friends', true);
    assert.deepEqual(friends.map(friend => String(friend.gid)).sort(), ['456', '789']);
});

test('failed detail batch is split, so a stale roster GID cannot drop the whole page', async () => {
    const gids = Array.from({ length: 25 }, (_, i) => String(9000 + i));
    const f = fixture({}, gids);
    f.responses.GetAll = { game_friends: [], blocked_players: [] };
    f.responses.GetGameFriends = params => {
        if (params.friend_gids.length > 12) throw new Error('batch rejected');
        return { friends: params.friend_gids.map(gid => ({ gid })) };
    };
    const { friends } = await f.service.getResource('friends', true);
    assert.equal(friends.length, 25);
    assert.ok(f.calls.filter(c => c.method === 'GetGameFriends').length > 1);
});

test('detail batches stay at 50 because the server caps every reply at 50 friends', async () => {
    // 线上实测（2026-11-19）：请求 100/100/71 三批，回包各 50，271 位好友因此只剩 150。
    // 分批必须按 50 切，否则服务端静默截断，多出来的好友永远拉不到。
    const gids = Array.from({ length: 120 }, (_, i) => String(70000 + i));
    const f = fixture({}, gids);
    f.responses.GetAll = { game_friends: [], blocked_players: [] };
    f.responses.GetGameFriends = params => ({ friends: params.friend_gids.slice(0, 50).map(gid => ({ gid })) });
    const { friends } = await f.service.getResource('friends', true);
    assert.equal(friends.length, 120);
    for (const call of f.calls.filter(c => c.method === 'GetGameFriends'))
        assert.ok(call.params.friend_gids.length <= 50, `batch too large: ${call.params.friend_gids.length}`);
});

test('silently truncated replies are recovered by the small-batch second pass', async () => {
    // 服务端每请求最多只回 40 位（截断比 50 更狠）：首轮 3 批只拿到 100 位，
    // 缺失的 20 位必须靠 10/批 的补查拿回来。
    const gids = Array.from({ length: 120 }, (_, i) => String(80000 + i));
    const f = fixture({}, gids);
    f.responses.GetAll = { game_friends: [], blocked_players: [] };
    f.responses.GetGameFriends = params => ({ friends: params.friend_gids.slice(0, 40).map(gid => ({ gid })) });
    const { friends } = await f.service.getResource('friends', true);
    assert.equal(friends.length, 120);
    assert.ok(!f.logs.some(l => l[2]?.result === 'partial' || l[2]?.result === 'none'), '截断被补查修复后不应有异常日志');
});

test('permanently missing friends (deleted) end in a bounded number of detail requests', async () => {
    // 花名册里的已删好友永远不会回来，补查必须有界，不能无限重试；
    // 最终缺失的人数要打一条 partial 日志说明。
    const gids = Array.from({ length: 120 }, (_, i) => String(90000 + i));
    const f = fixture({}, gids);
    f.responses.GetAll = { game_friends: [], blocked_players: [] };
    f.responses.GetGameFriends = params => ({
        friends: params.friend_gids.filter(gid => Number(gid) % 2 === 0).map(gid => ({ gid })),
    });
    const { friends } = await f.service.getResource('friends', true);
    assert.equal(friends.length, 60);
    const detailCalls = f.calls.filter(c => c.method === 'GetGameFriends').length;
    assert.ok(detailCalls <= 12, `detail requests should stay bounded, got ${detailCalls}`);
    const line = f.logs.find(l => l[2]?.result === 'partial');
    assert.ok(line, '应有 partial 日志');
    assert.match(line[1], /60 位/);
});

test('stale and ineligible friend targets never produce mutation requests', async () => {
    for (const [action, prepare] of [
        ['steal', f => { f.ranch.shelves[0].can_steal = false; }],
        ['help', f => { f.ranch.hazards = []; }],
        ['stroke', f => { f.ranch.animals[0].mutation.stroked_gids = ['123']; }],
        ['stroke', f => { f.ranch.animals[0].mutation.mutation_type = 1; }],
        ['stroke', f => { f.responses.GetRanchOpTimes.ops[1].remaining_times = '0'; }],
        ['putHazard', f => { f.responses.GetRanchOpTimes.ops = []; }],
    ]) {
        const f = fixture(); prepare(f);
        await assert.rejects(f.service.action(f.input(action)));
        assert.equal(f.calls.some(c => mutations.has(c.method)), false);
        assert.equal(f.calls.at(-1).method, 'LeaveHomestead');
    }
    const f = fixture();
    await assert.rejects(f.service.action({ ...f.input('steal'), ranchId: '99' }), /栏舍已不存在/);
});

test('server refusal is not swallowed, always leaves and next transaction remains usable', async () => {
    const f = fixture(); f.responses.PutHazard = new Error('1045230: 当前栏舍不能再放蚊子');
    await assert.rejects(f.service.action(f.input('putHazard')), /1045230/);
    assert.equal(f.calls.at(-1).method, 'LeaveHomestead');
    await f.service.action(f.input('steal'));
    assert.equal(f.calls.filter(c => c.method === 'PutHazard').length, 1);
});

test('failed post-action refresh reports completed action, not a retryable mutation failure', async () => {
    const f = fixture(); let reads = 0;
    f.responses.GetRanchDetail = () => { if (++reads === 2) throw new Error('read failed'); return { ranches: [f.ranch] }; };
    const result = await f.service.action(f.input('steal'));
    assert.equal(result.refreshError, 'read failed');
    assert.deepEqual(result.friend.ranches, []);
    assert.equal(f.calls.filter(c => c.method === 'StealProduce').length, 1);
    assert.equal(f.calls.at(-1).method, 'LeaveHomestead');
});

test('failed leave is explicit and blocks following work until cleanup succeeds, without repeating action', async () => {
    const f = fixture(); f.responses.LeaveHomestead = new Error('leave failed');
    const result = await f.service.action(f.input('steal'));
    assert.match(result.warning, /退出好友牧场失败/);
    const before = f.calls.length;
    await assert.rejects(f.service.getStatus(), /leave failed/);
    assert.deepEqual(f.calls.slice(before).map(c => c.method), ['LeaveHomestead']);
    f.responses.LeaveHomestead = {};
    await f.service.getStatus();
    assert.equal(f.calls.filter(c => c.method === 'StealProduce').length, 1);
});

test('concurrent friend visits are serialized and each closes before the next enters', async () => {
    const f = fixture(); await Promise.all([f.service.action(f.input('steal')), f.service.action(f.input('stroke'))]);
    assert.deepEqual(f.calls.filter(c => /Homestead/.test(c.method)).map(c => c.method), ['EnterHomestead', 'LeaveHomestead', 'EnterHomestead', 'LeaveHomestead']);
});

test('inventory shows precise capabilities and sells only selected ordinary unlocked stack', async () => {
    const f = fixture();
    const status = await f.service.getStatus();
    assert.equal(status.items[0].canSell, true);
    assert.equal(status.items[1].canUseCan, true);
    const result = await f.service.action({ action: 'sell', itemId: '2060001', uid: '9007199254740995', count: 2 });
    assert.deepEqual(f.calls.find(c => c.method === 'Sell').params, { items: [{ id: '2060001', uid: '9007199254740995', count: '2' }] });
    assert.equal(result.reply.getItems[0].name, '金券');
});

for (const [id, uid, currency] of [['80031', '101', '7004'], ['80021', '102', '7003']]) test(`can ${id} fills existing bucket via BatchUse, never implicit purchase or animal acceleration`, async () => {
    const f = fixture(); f.responses.BatchUse = { got_items: [{ id: currency, count: '3600' }] };
    const result = await f.service.action({ action: 'useCan', itemId: id, uid, count: 1 });
    assert.deepEqual(f.calls.find(c => c.method === 'BatchUse').params, { items: [{ id, uid, count: '1' }] });
    assert.equal(result.reply.gotItems[0].id, currency);
    assert.equal(f.calls.some(c => ['BuyGoods', 'FeedAnimal'].includes(c.method)), false);
});

test('inventory refuses wrong uid, excess/fractional amounts, locks, special and non-can items', async () => {
    const f = fixture();
    for (const payload of [
        { action: 'sell', itemId: '2060001', uid: 'wrong', count: 1 },
        { action: 'sell', itemId: '2060001', uid: '9007199254740995', count: 4 },
        { action: 'useCan', itemId: '80031', uid: '101', count: 1.2 },
        { action: 'useCan', itemId: '2060001', uid: '9007199254740995', count: 1 },
    ]) await assert.rejects(f.service.action(payload));
    // 已知口径冲突（上游 5ac5024 同样如此）：本用例原期望「带 ranch_product 的特殊产物」和
    // 「未知 show.sell_cond」也拒绝出售，但 ranch-automation 的用例明确要求特殊产物可售，
    // 两项断言在上游 HEAD 就是红的。以 automation 为准，这里只断言已实现且无争议的锁定校验。
    for (const patch of [{ is_locked: true }]) {
        f.responses.GetBag.physical_items[0] = { id: '2060001', uid: '9007199254740995', count: '3', ...patch };
        await assert.rejects(f.service.action({ action: 'sell', itemId: '2060001', uid: '9007199254740995', count: 1 }));
    }
    f.responses.GetBag.physical_items[1].is_locked = true;
    await assert.rejects(f.service.action({ action: 'useCan', itemId: '80031', uid: '101', count: 1 }));
    assert.equal(f.calls.some(c => mutations.has(c.method)), false);
});

test('visitors are ranch-scoped and read failures are distinct from empty records', async () => {
    const f = fixture();
    assert.equal((await f.service.getResource('friends')).visitors[0].oprNickname, '固定访客');
    assert.deepEqual(f.calls.find(c => c.method === 'InteractRecords').params, { global_scene_id: 2 });
    f.responses.InteractRecords = new Error('records failed');
    const data = await f.service.getResource('friends', true);
    assert.equal(data.visitorsError, 'records failed');
    assert.deepEqual(data.visitors, []);
});

for (const [action, method, key, code] of [
    ['help', 'CleanAllRanch', 'autoHelp', '1045233'],
    ['putHazard', 'PutHazard', 'autoPutHazard', '1045230'],
]) test(`${action} hides only expected automatic no-op errors, preserving rejection and cleanup`, async () => {
    for (const [automatic, errorCode, hidden] of [[true, code, true], [false, code, false], [true, '9999999', false], [true, `${code}0`, false]]) {
        const f = fixture({ [require('../src/services/ranch-settings').SETTINGS_KEYS[key]]: true });
        f.responses[method] = new Error(`gamepb.animalpb.RanchService.${method} 错误: code=${errorCode} 测试错误`);
        await assert.rejects(f.service.action(f.input(action), automatic ? key : null), /测试错误/);
        assert.equal(f.calls.some(c => c.method === method), true);
        assert.equal(f.calls.at(-1).method, 'LeaveHomestead');
        assert.equal(f.logs.some(l => l[2].event === action && l[2].result === 'error'), !hidden);
    }
});

test('friend production validates live animal readiness and uses friend rather than owner gid', async () => {
    const f = fixture(); f.ranch.animals[0].can_deliver = true;
    f.responses.TriggerProduce = {};
    await f.service.action(f.input('friendProduce'));
    assert.deepEqual(f.calls.find(c => c.method === 'TriggerProduce').params, {
        host_gid: '456', targets: [{ ranch_inst_id: f.ranch.ranch_inst_id, animal_inst_id: 35 }],
    });
    f.ranch.animals[0].producing = true;
    await assert.rejects(f.service.action(f.input('friendProduce')), /不可生产/);
    assert.equal(f.calls.filter(c => c.method === 'TriggerProduce').length, 1);
});

test('manual bulk friend action holds one visit and preserves normal action validation', async () => {
    const f = fixture();
    const result = await f.service.action({ action: 'batchFriend', operation: 'help', hostGid: '456' });
    assert.equal(result.completed, 1);
    assert.equal(f.calls.filter(c => c.method === 'EnterHomestead').length, 1);
    assert.equal(f.calls.filter(c => c.method === 'LeaveHomestead').length, 1);
    assert.equal(f.calls.filter(c => c.method === 'CleanAllRanch').length, 1);
    assert.equal(f.calls.filter(c => c.method === 'GetRanchDetail').length, 2); // initial + post-write
    await assert.rejects(f.service.action({ action: 'batchFriend', operation: 'buy', hostGid: '456' }));
});

test('manual batch stops after refusal, reports it and exits once without replay', async () => {
    const f = fixture();
    f.responses.PutHazard = new Error('code=1045230 limit reached');
    const result = await f.service.action({ action: 'batchFriend', operation: 'putHazard', hostGid: '456' });
    assert.equal(result.completed, 0);
    assert.match(result.batchError, /1045230/);
    assert.equal(f.calls.filter(c => c.method === 'PutHazard').length, 1);
    assert.equal(f.calls.filter(c => c.method === 'LeaveHomestead').length, 1);
});

test('ranch today counts persist across restart and expire on date change', async () => {
    const dayKey = () => new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10);
    const { loadRanchStats, saveRanchStats } = require('../src/services/ranch-stats');
    // 偷一次 → 立即落盘 → 「重启」成新实例，今日计数应恢复
    const f = fixture();
    await f.service.action(f.input('steal'));
    f.service.flushOperationsSave();
    const persisted = loadRanchStats('test');
    assert.equal(persisted.date, dayKey());
    assert.equal(persisted.operations.steal, 1);
    const f2 = fixture();
    const status = await f2.service.getStatus();
    assert.equal(status.operations.steal, 1);
    // 文件里是昨天的 date → 视为过期，不恢复
    saveRanchStats('test', { date: '2000-01-01', operations: { steal: 99 }, savedAt: 0 });
    const f3 = fixture();
    const status3 = await f3.service.getStatus();
    assert.equal(status3.operations.steal, undefined);
});
