const test = require('node:test');
const assert = require('node:assert/strict');
const cache = require('../src/services/shop-cache');

test('shop cache serves the catalog, dedupes concurrent loads and invalidates by prefix', async () => {
    cache.invalidate();
    let loads = 0;
    const loader = async () => {
        loads++;
        await new Promise(resolve => setTimeout(resolve, 5));
        return { goods: [{ id: '1' }] };
    };
    const [first, second] = await Promise.all([
        cache.remember('farm-shop:2', loader),
        cache.remember('farm-shop:2', loader),
    ]);
    assert.equal(loads, 1, '并发打开商城只应触发一次真实请求');
    assert.deepEqual(first, second);
    assert.deepEqual(await cache.remember('farm-shop:2', loader), { goods: [{ id: '1' }] });
    assert.equal(loads, 1, 'TTL 内重复读取直接命中缓存');

    await cache.remember('farm-mall', async () => ({ goods: [] }));
    cache.invalidate('farm-shop:');
    await cache.remember('farm-shop:2', loader);
    assert.equal(loads, 2, '前缀失效后重新拉取');
    assert.ok(cache.peek('farm-mall'), '其他分区不受影响');

    await cache.remember('farm-shop:2', loader, { force: true });
    assert.equal(loads, 3, 'force 绕过缓存');
    cache.invalidate();
    assert.equal(cache.peek('farm-mall'), null);
});
