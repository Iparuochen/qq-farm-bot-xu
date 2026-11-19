const test = require('node:test');
const assert = require('node:assert/strict');
const { createRanchScheduler, inGroup } = require('../src/services/ranch-scheduler');

test('ranch/help/steal queues execute on independent real deadlines', async () => {
    let now = 100000;
    const scheduler = createRanchScheduler({ now: () => now, random: () => 0 });
    const settings = () => ({ autoCollect: true, autoHelp: true, autoSteal: true });
    const policy = () => ({ farmMin: 2, farmMax: 5, helpMin: 10, helpMax: 15 });
    const calls = [];
    const tick = () => scheduler.tick({ settings, policy, stealDelay: () => 60000, run: async key => { calls.push(key); } });
    await tick();
    assert.deepEqual(calls, ['farm', 'help', 'steal']);
    const state = scheduler.status(settings(), policy());
    assert.equal(state.farm.nextAt, now + 2000);
    assert.equal(state.help.nextAt, now + 10000);
    assert.equal(state.steal.nextAt, now + 60000);
    calls.length = 0;
    now += 2000;
    await tick();
    assert.deepEqual(calls, ['farm']);
    calls.length = 0;
    now += 8000;
    await tick();
    assert.deepEqual(calls, ['farm', 'help']);
});

test('disable, interval change, overlap and offline are enforced by the scheduler', async () => {
    let now = 100000;
    let enabled = true;
    let min = 2;
    let finish;
    const scheduler = createRanchScheduler({ now: () => now, random: () => 1 - Number.EPSILON });
    const settings = () => ({ autoCollect: enabled });
    const policy = () => ({ farmMin: min, farmMax: 5 });
    let count = 0;
    const task = scheduler.tick({ settings, policy, run: () => new Promise(resolve => { count++; finish = resolve; }) });
    await scheduler.tick({ settings, policy, run: async () => { count++; } });
    assert.equal(count, 1);
    enabled = false;
    finish();
    await task;
    assert.equal(scheduler.status(settings(), policy()).farm.nextAt, 0);
    enabled = true;
    min = 4;
    await scheduler.tick({ settings, policy, ready: () => false, run: async () => { count++; } });
    assert.equal(count, 1);
    now += 1000;
    await scheduler.tick({ settings, policy, run: async () => { count++; } });
    assert.equal(scheduler.status(settings(), policy()).farm.intervalSec, 5);
    min = 5;
    assert.equal(scheduler.status(settings(), policy()).farm.nextAt, now);
});

test('task groups do not leak own-ranch actions into friend checks', () => {
    for (const key of ['autoCollect', 'autoClean', 'autoProduce', 'autoHarvest', 'autoFeedAnimal', 'autoPlace', 'autoSell', 'autoSubmitOrders']) {
        assert.equal(inGroup(key, 'farm'), true);
        assert.equal(inGroup(key, 'help'), false);
        assert.equal(inGroup(key, 'steal'), false);
    }
    assert.equal(inGroup('autoSteal', 'steal'), true);
    for (const key of ['autoHelp', 'autoStroke', 'autoPutHazard']) assert.equal(inGroup(key, 'help'), true);
});

test('one failed queue does not prevent the other queues from executing', async () => {
    const scheduler = createRanchScheduler();
    const calls = [];
    await assert.rejects(scheduler.tick({ settings: () => ({ autoCollect: true, autoHelp: true, autoSteal: true }), policy: () => ({}), run: async key => { calls.push(key); if (key === 'farm') throw Error('fixture failure'); } }), /fixture failure/);
    assert.deepEqual(calls, ['farm', 'help', 'steal']);
});

test('all due groups register before a slow group completes, with no duplicate submissions', async () => {
    const s = createRanchScheduler();
    let release;
    const calls = [];
    const options = { settings: () => ({ autoCollect: true, autoHelp: true, autoSteal: true }), policy: () => ({}), run: async key => {
        calls.push(key);
        if (key === 'farm') await new Promise(resolve => { release = resolve; });
    } };
    const first = s.tick(options);
    assert.deepEqual(calls, ['farm', 'help', 'steal']);
    await s.tick(options);
    assert.equal(calls.filter(k => k === 'farm').length, 1);
    release(); await first;
});

test('yield/defer remain due, errors back off, deadlines can wake early', async () => {
    const s = createRanchScheduler({ now: () => 10000 });
    const settings = () => ({ autoCollect: true });
    const policy = () => ({ farmMin: 60, farmMax: 60 });
    for (const status of ['yielded', 'deferred']) {
        await s.tick({ settings, policy, run: async () => ({ status }) });
        assert.equal(s.status(settings(), policy()).farm.nextAt, 10000);
    }
    await s.tick({ settings, policy, run: async () => ({ status: 'completed', nextAt: 12000 }) });
    assert.equal(s.status(settings(), policy()).farm.nextAt, 12000);
});

test('old completion cannot overwrite a reset generation', async () => {
    const s = createRanchScheduler({ now: () => 10000 });
    let release;
    const settings = () => ({ autoCollect: true }); const policy = () => ({});
    const job = s.tick({ settings, policy, run: () => new Promise(r => { release = r; }) });
    s.reset();
    release(); await job;
    assert.equal(s.status(settings(), policy()).farm.nextAt, 10000);
    assert.equal(s.status(settings(), policy()).farm.running, false);
});
