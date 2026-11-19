// Build-time official inventory icons only; never writes into QQ containers.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { findLatestSource } = require('../src/services/activity-update-scanner');
const finder = require('../src/services/cdn-resource-finder');
const config = require('../src/gameConfig/RanchConfig.json');
const sha = data => crypto.createHash('sha256').update(data).digest('hex');
(async () => {
    const source = findLatestSource(path.join(os.homedir(), 'Library/Containers/com.tencent.qqexminiprogram/Data/Library/Application Support/QQEX/miniapp/temps/miniapp_src')).latest?.directory;
    if (!source) throw new Error('No complete official source');
    const settingsFile = finder.findSettingsFile(source);
    const settings = JSON.parse(fs.readFileSync(settingsFile));
    const configUrl = finder.bundleConfigUrl(settings, 'animal');
    const response = await fetch(configUrl);
    if (!response.ok) throw new Error(`Bundle ${response.status}`);
    const bundle = await response.json();
    const output = path.resolve(__dirname, '../../web/public/game-config/ranch-icons/animals');
    fs.mkdirSync(output, { recursive: true });
    const animals = {};
    const files = [];
    for (const animal of config.MCAnimalConfig) {
        const icons = {};
        for (const variant of [1, 4]) {
            const assetPath = `texture/${animal.cub_item_id}_${variant}`;
            const entry = Object.entries(bundle.paths).find(([, value]) => value[0] === assetPath && bundle.types[value[1]] === 'cc.ImageAsset');
            if (!entry) throw new Error(`Missing ${assetPath}`);
            const url = finder.assetUrl(settings, 'animal', bundle, entry[0]);
            const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
            if (!res.ok) throw new Error(`${res.status} ${url}`);
            const data = Buffer.from(await res.arrayBuffer());
            if (data.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') throw new Error(`Not a PNG: ${url}`);
            const file = `${animal.id}_${variant}.png`;
            fs.writeFileSync(path.join(output, file), data);
            icons[variant] = `/game-config/ranch-icons/animals/${file}`;
            files.push({ file, animalId: animal.id, assetPath, url, sha256: sha(data) });
        }
        animals[animal.id] = icons;
    }
    fs.writeFileSync(path.join(output, 'sources.json'), JSON.stringify({ source, settingsSha256: sha(fs.readFileSync(settingsFile)), configUrl, animals, files }, null, 2) + '\n');
    fs.writeFileSync(path.resolve(__dirname, '../src/gameConfig/RanchAnimalIcons.json'), JSON.stringify(animals, null, 2) + '\n');
    console.log(`Saved ${files.length} official icons for ${Object.keys(animals).length} animals`);
})().catch(error => { console.error(error); process.exitCode = 1; });
