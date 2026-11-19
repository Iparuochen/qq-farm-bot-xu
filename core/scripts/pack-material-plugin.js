#!/usr/bin/env node
/**
 * 把 core/src/gameConfig/ 下的活动植物增量 + 种子/阶段图片 + 牧场视觉素材
 * （ranch_visuals / animal_images / web/public 的 ranch-icons）打包成一个素材插件目录。
 * 生成的目录默认放到 core/plugins/material-plugin/，宿主启动时 bootstrapBuiltins()
 * 会自动扫描 plugins/<id>/manifest.json 并复制安装到 data/plugins/installed/<id>/<version>/。
 *
 * 后续更新只需：拉 CDN 新配置 → 重新打包（覆盖 material-plugin/）→ 重启。
 * 也可以管理面板上传升级（支持 zip 形式）。
 *
 * 用法：
 *   node scripts/pack-material-plugin.js                           → 默认 plugins/material-plugin/
 *   node scripts/pack-material-plugin.js --version 1.0.1           → 改 manifest 版本号
 *   node scripts/pack-material-plugin.js --out dist/my-plugin-dir  → 自定义输出目录
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const coreRoot = path.resolve(__dirname, '..');
const baseGameConfig = path.join(coreRoot, 'src', 'gameConfig');

function sha256(filePath) {
    return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function parseArgs(argv) {
    const result = {
        id: 'material-plugin',
        name: 'QQ农场基础素材包',
        version: '1.0.0',
        out: null,
    };
    for (let i = 0; i < argv.length; i += 1) {
        const value = argv[i];
        if (value === '--id') result.id = argv[++i];
        else if (value === '--name') result.name = argv[++i];
        else if (value === '--version') result.version = argv[++i];
        else if (value === '--out') result.out = path.resolve(argv[++i]);
        else if (value === '-h' || value === '--help') {
            console.log(`素材插件打包工具（目录形式）

用法：
  node scripts/pack-material-plugin.js [--id <slug>] [--name <显示名>] [--version x.y.z] [--out <目录>]

默认：
  --id material-plugin
  --name QQ农场基础素材包
  --version 1.0.0
  --out core/plugins/material-plugin/
`);
            process.exit(0);
        }
    }
    if (!result.out) result.out = path.join(coreRoot, 'plugins', result.id);
    return result;
}

function collectDir(root, sub, assetsList, prefixInDir) {
    const dir = path.join(root, sub);
    if (!fs.existsSync(dir)) return 0;
    let count = 0;
    function walk(current, relative) {
        for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
            // 跳过 .DS_Store / .thumbnails 之类的隐藏条目，避免把编辑器垃圾打进素材包
            if (entry.name.startsWith('.')) continue;
            const full = path.join(current, entry.name);
            const rel = relative ? `${relative}/${entry.name}` : entry.name;
            if (entry.isDirectory()) walk(full, rel);
            else {
                const destRel = `${prefixInDir}/${rel.replace(/\\/g, '/')}`;
                assetsList.push({ disk: full, dest: destRel, sha256: sha256(full) });
                count += 1;
            }
        }
    }
    walk(dir, '');
    return count;
}

/**
 * 牧场素材：三类目录都不在 core/src/gameConfig/plant_images 那套命名里。
 * - animal_images：农场动物阶段图，历史遗留，只存在于插件里（src 无镜像）
 * - ranch_visuals：牧场动物四姿态 + 建筑 prefab 图，后端 ranch-visuals.js 按 manifest 引用
 * - ranch-icons：牧场道具/动物图标，前端按 /game-config/ranch-icons/... 绝对路径引用，
 *   源文件在 web/public 下（vite 静态 + 构建时拷进 dist）
 * 少任何一类，全新 clone 或纯后端部署都会裂图，所以必须一并进插件。
 */
const extraSources = [
    { label: 'animal_images', src: path.join(baseGameConfig, 'animal_images'), dest: 'assets/animal_images' },
    { label: 'ranch_visuals', src: path.join(baseGameConfig, 'ranch_visuals'), dest: 'assets/ranch_visuals' },
    { label: 'ranch-icons', src: path.join(coreRoot, '..', 'web', 'public', 'game-config', 'ranch-icons'), dest: 'assets/ranch-icons' },
];

function collectExtras(assetsList) {
    const counts = {};
    for (const source of extraSources) {
        if (!fs.existsSync(source.src)) { counts[source.label] = 0; continue; }
        const before = assetsList.length;
        (function walk(current, relative) {
            for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
                if (entry.name.startsWith('.')) continue;
                const full = path.join(current, entry.name);
                const rel = relative ? `${relative}/${entry.name}` : entry.name;
                if (entry.isDirectory()) walk(full, rel);
                else assetsList.push({ disk: full, dest: `${source.dest}/${rel.replace(/\\/g, '/')}`, sha256: sha256(full) });
            }
        })(source.src, '');
        counts[source.label] = assetsList.length - before;
    }
    return counts;
}

function main() {
    const args = parseArgs(process.argv.slice(2));
    if (!fs.existsSync(baseGameConfig)) {
        console.error(`gameConfig 目录不存在：${baseGameConfig}`);
        process.exit(1);
    }

    // 收集要打包的文件与 sha256
    const assets = [];

    const plantImagesCount = collectDir(baseGameConfig, 'plant_images', assets, 'assets/plant_images');
    const seedImagesCount = collectDir(baseGameConfig, 'seed_images_named', assets, 'assets/seed_images_named');
    const effectImagesCount = collectDir(baseGameConfig, 'effect_images', assets, 'assets/effect_images');
    const extraCounts = collectExtras(assets);

    const eventPlantsPath = path.join(baseGameConfig, 'EventPlants.json');
    const eventPlantsCount = fs.existsSync(eventPlantsPath)
        ? JSON.parse(fs.readFileSync(eventPlantsPath, 'utf8').replace(/^\uFEFF/, '')).length
        : 0;

    console.log(`[素材插件] catalog/EventPlants.json: ${eventPlantsCount} 条`);
    console.log(`[素材插件] assets/plant_images/: ${plantImagesCount} 个文件`);
    console.log(`[素材插件] assets/seed_images_named/: ${seedImagesCount} 个文件`);
    console.log(`[素材插件] assets/effect_images/: ${effectImagesCount} 个文件`);
    for (const [label, count] of Object.entries(extraCounts)) {
        console.log(`[素材插件] assets/${label}/: ${count} 个文件`);
    }
    console.log(`[素材插件] 总计素材文件: ${assets.length}`);

    // 生成 manifest.json
    const manifest = {
        id: args.id,
        name: args.name,
        version: args.version,
        apiVersion: 1,
        description: `自动打包自 core/src/gameConfig 与 web/public/game-config 的基础素材包，提供活动植物增量表、种子/阶段图与牧场视觉素材，宿主自动合并`,
        activityIds: [],
        windows: [
            { key: 'permanent', startTime: 0, endTime: 0 },
        ],
        automation: [],
        gameConfig: {
            provides: true,
            urlPrefix: '/game-config',
        },
        card: {
            icon: 'i-carbon-image',
            image: '',
            updatedMs: Date.now(),
        },
    };

    // 生成 backend/index.js stub（素材插件不需要活动面板和 worker）
    const backendStub = `// 素材插件 backend stub：不提供活动面板、自动化或协议服务；
// 只靠 manifest.gameConfig.provides=true 让宿主自动把 assets/ 与 catalog/ 合并进核心配置。
module.exports = {
    apiVersion: 1,
    admin: {
        register() {},
        unregister() {},
    },
    worker: {
        register() {},
        unregister() {},
    },
};
`;

    // 清空输出目录并重建
    const outDir = args.out;
    let preservedDir = null;
    if (fs.existsSync(outDir)) {
        preservedDir = path.join(path.dirname(outDir), `.${path.basename(outDir)}.prev-${Date.now()}`);
        fs.renameSync(outDir, preservedDir);
    }
    fs.mkdirSync(outDir, { recursive: true });

    // 写 manifest
    fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');

    // 写 backend/index.js
    fs.mkdirSync(path.join(outDir, 'backend'), { recursive: true });
    fs.writeFileSync(path.join(outDir, 'backend', 'index.js'), backendStub, 'utf8');

    // 写 catalog/EventPlants.json
    if (fs.existsSync(eventPlantsPath)) {
        fs.mkdirSync(path.join(outDir, 'catalog'), { recursive: true });
        fs.copyFileSync(eventPlantsPath, path.join(outDir, 'catalog', 'EventPlants.json'));
    }

    // 复制本次收集到的素材
    fs.mkdirSync(path.join(outDir, 'assets'), { recursive: true });
    for (const item of assets) {
        const destFull = path.join(outDir, item.dest);
        fs.mkdirSync(path.dirname(destFull), { recursive: true });
        fs.copyFileSync(item.disk, destFull);
    }

    // 把旧包里本次没产出的素材原样搬回（增量超集）
    let preservedCount = 0;
    if (preservedDir) {
        const regenerated = new Set(['manifest.json', 'backend/index.js', 'catalog/EventPlants.json', 'assets/assets-map.json']);
        (function walk(current, relative) {
            for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
                const full = path.join(current, entry.name);
                const rel = (relative ? `${relative}/` : '') + entry.name;
                if (entry.isDirectory()) { walk(full, rel); continue; }
                if (regenerated.has(rel)) continue;
                const destFull = path.join(outDir, rel);
                if (fs.existsSync(destFull)) continue;
                fs.mkdirSync(path.dirname(destFull), { recursive: true });
                fs.copyFileSync(full, destFull);
                preservedCount += 1;
            }
        })(preservedDir, '');
        fs.rmSync(preservedDir, { recursive: true, force: true });
        console.log(`[素材插件] 增量保留旧素材: ${preservedCount} 个文件`);
    }

    // assets-map.json 按「最终落盘结果」重算，保证被保留的旧素材也在清单里
    const finalMap = [];
    (function walk(current, relative) {
        for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
            const full = path.join(current, entry.name);
            const rel = (relative ? `${relative}/` : '') + entry.name;
            if (entry.isDirectory()) { walk(full, rel); continue; }
            if (rel === 'assets-map.json') continue;
            finalMap.push({ file: rel, sha256: sha256(full), size: fs.statSync(full).size });
        }
    })(path.join(outDir, 'assets'), '');
    finalMap.sort((a, b) => (a.file < b.file ? -1 : 1));
    fs.writeFileSync(
        path.join(outDir, 'assets', 'assets-map.json'),
        JSON.stringify(finalMap, null, 2),
        'utf8',
    );
    console.log(`[素材插件] assets-map.json: ${finalMap.length} 条`);

    // 统计输出
    let totalBytes = 0;
    let totalFiles = 0;
    function walkSize(dir) {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) walkSize(full);
            else { totalBytes += entry.size ?? fs.statSync(full).size; totalFiles += 1; }
        }
    }
    walkSize(outDir);
    console.log(`[素材插件] 已生成目录：${outDir} (${totalFiles} 个文件，${(totalBytes / 1024 / 1024).toFixed(1)} MB)`);
}

try { main(); } catch (err) { console.error('[素材插件] 打包失败：', err.message || err); process.exit(1); }
