/**
 * 牧场素材归位回归用例。
 *
 * 背景：牧场是从参考项目整块移植过来的，图集最初散落在两处 ——
 *   - core/src/gameConfig/ranch_visuals（后端 ranch-visuals.js 按 manifest 引用）
 *   - web/public/game-config/ranch-icons（前端按 /game-config/ranch-icons/... 引用）
 * 这两处都不在素材插件里，导致「只装插件不 clone web」「全新 clone 没同步工作目录」
 * 两种部署都裂图。本用例把「牧场图片必须能在插件里找到」钉成断言。
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const coreRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(coreRoot, '..');
const gameConfigDir = path.join(coreRoot, 'src', 'gameConfig');
const pluginAssets = path.join(coreRoot, 'plugins', 'material-plugin', 'assets');
const webPublic = path.join(repoRoot, 'web', 'public');

/** 把 /game-config/xxx 映射到磁盘上的候选根目录，返回第一个命中的绝对路径 */
function resolveGameConfigAsset(url) {
    const relative = String(url).replace(/^\/game-config\//, '');
    const roots = [gameConfigDir, pluginAssets, webPublic];
    for (const root of roots) {
        const candidate = path.join(root, relative);
        if (fs.existsSync(candidate)) return candidate;
    }
    return null;
}

/** 递归收集 /game-config/... 形式的图片引用 */
function collectImageUrls(value, bucket) {
    if (typeof value === 'string') {
        if (value.startsWith('/game-config/') && /\.png$/i.test(value)) bucket.add(value);
        return bucket;
    }
    if (Array.isArray(value)) {
        for (const item of value) collectImageUrls(item, bucket);
        return bucket;
    }
    if (value && typeof value === 'object') {
        for (const item of Object.values(value)) collectImageUrls(item, bucket);
    }
    return bucket;
}

function readJson(file) {
    return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
}

const iconSources = [
    ['RanchAnimalIcons.json', path.join(gameConfigDir, 'RanchAnimalIcons.json')],
    ['RanchItemIcons.json', path.join(gameConfigDir, 'RanchItemIcons.json')],
    ['ranch_visuals/manifest.json', path.join(gameConfigDir, 'ranch_visuals', 'manifest.json')],
];

for (const [name, file] of iconSources) {
    test(`牧场素材可解析：${name}`, () => {
        assert.ok(fs.existsSync(file), `缺少 ${name}`);
        const urls = [...collectImageUrls(readJson(file), new Set())];
        assert.ok(urls.length > 0, `${name} 未收集到任何图片引用`);
        const missing = urls.filter(url => !resolveGameConfigAsset(url));
        assert.deepEqual(missing, [], `${name} 有 ${missing.length} 张图在磁盘上找不到`);
    });
}

test('牧场素材必须进素材插件（否则全新 clone / 纯后端部署裂图）', () => {
    assert.ok(fs.existsSync(pluginAssets), '素材插件 assets 目录不存在，先跑 scripts/pack-material-plugin.js');

    for (const dir of ['ranch-icons', 'ranch_visuals']) {
        const full = path.join(pluginAssets, dir);
        assert.ok(fs.existsSync(full), `素材插件缺少 assets/${dir}`);
    }

    const sources = [
        ['RanchAnimalIcons.json', path.join(gameConfigDir, 'RanchAnimalIcons.json')],
        ['RanchItemIcons.json', path.join(gameConfigDir, 'RanchItemIcons.json')],
        ['ranch_visuals/manifest.json', path.join(gameConfigDir, 'ranch_visuals', 'manifest.json')],
    ];
    const notInPlugin = [];
    for (const [name, file] of sources) {
        for (const url of collectImageUrls(readJson(file), new Set())) {
            const relative = url.replace(/^\/game-config\//, '');
            if (!fs.existsSync(path.join(pluginAssets, relative))) notInPlugin.push(`${name} → ${url}`);
        }
    }
    assert.deepEqual(notInPlugin, [], `有 ${notInPlugin.length} 张牧场图片没进素材插件`);
});
