const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const gameConfig = require('../src/config/gameConfig');

function makeProviderDir(rows) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gc-provider-'));
    fs.mkdirSync(path.join(dir, 'catalog'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'catalog', 'ItemInfo.json'), JSON.stringify(rows), 'utf8');
    return dir;
}

test('插件 catalog/ItemInfo.json 只补缺失物品，不覆盖宿主已有行', () => {
    const rows = [
        // 宿主 ItemInfo 里已有 1001=金币：用同名不同内容尝试覆盖，应被忽略
        { id: 1001, type: 2, name: '假金币' },
        // 宿主缺失的新物品：应被补进来
        { id: 9900001, type: 4, name: '测试黄金果实', asset_name: 'gold/Crop_test' },
        // type=5 的种子物品：应同时进种子索引
        { id: 9900002, type: 5, name: '测试种子', asset_name: 'Crop_test_Seed', interaction_type: 'plant' },
        // 非法/异常行：应被安全跳过
        null,
        { id: 0, name: '无效ID' },
        { id: -5, name: '负数ID' },
    ];
    const dir = makeProviderDir(rows);

    gameConfig.registerExternalGameConfigProvider(dir);
    try {
        assert.equal(gameConfig.getItemById(9900001)?.name, '测试黄金果实');
        assert.equal(gameConfig.getItemById(9900002)?.name, '测试种子');
        // 种子索引
        assert.equal(gameConfig.isSeedItem(9900002), true);
        assert.equal(gameConfig.isSeedItem(9900001), false);
        // 不覆盖宿主已有物品
        assert.equal(gameConfig.getItemById(1001)?.name, '金币');
    } finally {
        gameConfig.unregisterExternalGameConfigProvider(dir);
    }

    // 卸载 provider 后，增量物品随之消失，宿主物品恢复
    assert.equal(gameConfig.getItemById(9900001), undefined);
    assert.equal(gameConfig.getItemById(9900002), undefined);
    assert.equal(gameConfig.getItemById(1001)?.name, '金币');
});

test('插件 catalog/ItemInfo.json 缺失或非数组时不影响宿主配置', () => {
    // 没有 catalog/ItemInfo.json 的 provider
    const dirOnlyPlants = fs.mkdtempSync(path.join(os.tmpdir(), 'gc-provider-'));
    fs.mkdirSync(path.join(dirOnlyPlants, 'catalog'), { recursive: true });
    fs.writeFileSync(path.join(dirOnlyPlants, 'catalog', 'EventPlants.json'), '[]', 'utf8');

    // ItemInfo.json 是对象而非数组
    const dirBadShape = fs.mkdtempSync(path.join(os.tmpdir(), 'gc-provider-'));
    fs.mkdirSync(path.join(dirBadShape, 'catalog'), { recursive: true });
    fs.writeFileSync(path.join(dirBadShape, 'catalog', 'ItemInfo.json'), '{"id":1}', 'utf8');

    const seedCountBefore = gameConfig.getAllSeeds().length;
    const coinBefore = gameConfig.getItemById(1001)?.name;

    gameConfig.registerExternalGameConfigProvider(dirOnlyPlants);
    gameConfig.registerExternalGameConfigProvider(dirBadShape);
    try {
        assert.equal(gameConfig.getItemById(1001)?.name, coinBefore);
        assert.ok(gameConfig.getAllSeeds().length >= seedCountBefore);
    } finally {
        gameConfig.unregisterExternalGameConfigProvider(dirOnlyPlants);
        gameConfig.unregisterExternalGameConfigProvider(dirBadShape);
    }
    assert.equal(gameConfig.getItemById(1001)?.name, coinBefore);
});
