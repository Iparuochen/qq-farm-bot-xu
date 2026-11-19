const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Long = require('long');
const { createLocalFriendCache } = require('../src/services/local-friend-cache');
test('local friend caches isolate accounts/scenes, coalesce loads and preserve int64 on disk', async t => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'friend-cache-test-'));
    t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
    let clock = 0, scope = 'account1', calls = 0;
    const options = { key: 'farm', scope: () => scope, now: () => clock, directory: () => dir, ttlMs: 300000 };
    const cache = createLocalFriendCache(options);
    const load = async () => { calls++; return [{ gid: Long.fromString('9007199254740993') }]; };
    await Promise.all([cache.get(load), cache.get(load)]);
    assert.equal(calls, 1);
    const reloaded = createLocalFriendCache(options);
    assert.equal((await reloaded.get(load))[0].gid.toString(), '9007199254740993');
    assert.equal(calls, 1);
    scope = 'account2'; await cache.get(load); assert.equal(calls, 2);
    await createLocalFriendCache({ ...options, key: 'ranch' }).get(load); assert.equal(calls, 3);
    clock = 300000;
    await assert.rejects(cache.get(async () => { throw Error('offline'); }), /offline/);
    await cache.get(load); assert.equal(calls, 4);
    await cache.get(load, true); assert.equal(calls, 5);
    cache.clear(); await cache.get(load); assert.equal(calls, 6);
});

test('invalidated in-flight friend list cannot repopulate deleted cache', async () => {
    const cache = createLocalFriendCache({ key: 'test', scope: () => '' });
    let finish;
    const old = cache.get(() => new Promise(resolve => { finish = resolve; }));
    await Promise.resolve();
    cache.clear();
    finish(['removed']); await old;
    assert.deepEqual(await cache.get(async () => ['current']), ['current']);
});
