// Offline build-time export. Official QQ source is read-only.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { findLatestSource } = require('../src/services/activity-update-scanner');
const finder = require('../src/services/cdn-resource-finder');
const { getItemImageById } = require('../src/config/gameConfig');
const { MCItemInfo } = require('../src/gameConfig/RanchConfig.json');
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
(async () => {
    const source = findLatestSource(path.join(os.homedir(), 'Library/Containers/com.tencent.qqexminiprogram/Data/Library/Application Support/QQEX/miniapp/temps/miniapp_src')).latest?.directory;
    if (!source) throw new Error('No complete official source');
    const settings = JSON.parse(fs.readFileSync(finder.findSettingsFile(source)));
    const configUrl = finder.bundleConfigUrl(settings, 'animal');
    const response = await fetch(configUrl);
    if (!response.ok) throw new Error(`Bundle HTTP ${response.status}`);
    const bundle = await response.json();
    const directory = path.resolve(__dirname, '../../web/public/game-config/ranch-icons/items');
    fs.mkdirSync(directory, { recursive: true });
    const images = [], missing = [], mapping = {};
    for (const item of MCItemInfo.filter(row => Number(row.show_tab_ids) >= 5)) {
        const assetPath = `texture/${item.asset_name}`;
        const entry = Object.entries(bundle.paths).find(([, v]) => v[0] === assetPath && bundle.types[v[1]] === 'cc.ImageAsset');
        if (!entry && getItemImageById(item.id)) continue;
        if (!entry) { missing.push({ id: item.id, name: item.name, assetPath }); continue; }
        const url = finder.assetUrl(settings, 'animal', bundle, entry[0]);
        const file = `${item.asset_name}.png`;
        const target = path.join(directory, file);
        // Multiple IDs can intentionally share the same official asset.
        const previous = images.find(image => image.file === file);
        let bytes;
        if (previous) bytes = fs.readFileSync(target);
        else {
            const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
            if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
            bytes = Buffer.from(await res.arrayBuffer());
            if (bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') throw new Error(`Not PNG: ${url}`);
            fs.writeFileSync(target, bytes);
        }
        mapping[item.id] = `/game-config/ranch-icons/items/${file}`;
        images.push({ id: item.id, name: item.name, file, assetPath, url, sha256: sha(bytes) });
    }
    fs.writeFileSync(path.join(directory, 'sources.json'), JSON.stringify({ source, configUrl, images, missing }, null, 2) + '\n');
    fs.writeFileSync(path.resolve(__dirname, '../src/gameConfig/RanchItemIcons.json'), JSON.stringify(mapping, null, 2) + '\n');
    console.log(JSON.stringify({ mapped: images.length, missing }, null, 2));
})().catch(error => { console.error(error); process.exitCode = 1; });
