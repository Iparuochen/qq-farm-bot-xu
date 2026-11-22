const test = require('node:test');
const assert = require('node:assert/strict');
const { cacheFarmPanel, peekFarmPanel, dropFarmPanel } = require('../src/services/farm-panel-cache');

/**
 * 农场面板快照缓存（stale-serve）：
 * worker 层在进场景前 peek，命中直接回包不排队；写操作 / TTL 到期失效。
 * 这里验证：读回填、TTL 过期删除、按分区 drop、无参全清、falsy 数据不写入、未知 key 回退 60s。
 */
test('farm panel cache: cache then peek returns the same data', () => {
    dropFarmPanel();
    const data = { lands: [{ id: 1 }], summary: {} };
    cacheFarmPanel('lands', data);
    assert.equal(peekFarmPanel('lands'), data);
});

test('farm panel cache: cacheFarmPanel no-ops on falsy data', () => {
    dropFarmPanel();
    cacheFarmPanel('bag', null);
    cacheFarmPanel('bagSeeds', undefined);
    assert.equal(peekFarmPanel('bag'), null);
    assert.equal(peekFarmPanel('bagSeeds'), null);
});

test('farm panel cache: entries expire past TTL and are deleted on peek', () => {
    dropFarmPanel();
    const realNow = Date.now;
    let t = 1_000_000;
    Date.now = () => t;
    try {
        cacheFarmPanel('lands', { lands: [] });
        assert.ok(peekFarmPanel('lands'));
        // 刚好 60s 未过期（用 > 判断），推进 1ms 后过期
        t += 60_001;
        assert.equal(peekFarmPanel('lands'), null);
        // 过期后已被删除
        assert.equal(peekFarmPanel('lands'), null);
    } finally {
        Date.now = realNow;
    }
});

test('farm panel cache: unknown key falls back to 60s TTL', () => {
    dropFarmPanel();
    const realNow = Date.now;
    let t = 2_000_000;
    Date.now = () => t;
    try {
        cacheFarmPanel('custom', { ok: true });
        assert.ok(peekFarmPanel('custom'));
        t += 60_001;
        assert.equal(peekFarmPanel('custom'), null);
    } finally {
        Date.now = realNow;
    }
});

test('farm panel cache: dropFarmPanel with keys removes only those sections', () => {
    dropFarmPanel();
    cacheFarmPanel('lands', { a: 1 });
    cacheFarmPanel('bag', { b: 1 });
    cacheFarmPanel('bagSeeds', { c: 1 });
    dropFarmPanel('bag', 'bagSeeds');
    assert.ok(peekFarmPanel('lands'));
    assert.equal(peekFarmPanel('bag'), null);
    assert.equal(peekFarmPanel('bagSeeds'), null);
});

test('farm panel cache: dropFarmPanel() with no args clears everything', () => {
    cacheFarmPanel('lands', { a: 1 });
    cacheFarmPanel('bag', { b: 1 });
    dropFarmPanel();
    assert.equal(peekFarmPanel('lands'), null);
    assert.equal(peekFarmPanel('bag'), null);
});
