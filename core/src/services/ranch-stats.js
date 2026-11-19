const process = require('node:process');
const path = require('node:path');
const { readJsonFile, writeJsonFileAtomic } = require('./json-db');

// 牧场今日操作计数的持久化：与 stats.js（农场统计）同一套做法——
// 文件带 date 字段，只有 date === 今天 的数据才恢复，隔日自动视为过期清零。
// 文件按账号隔离：每个 worker 进程有自己的 FARM_ACCOUNT_ID，互不串号。

function ranchStatsFilePath(accountId) {
    const baseDir = process.env.FARM_DATA_DIR || path.join(__dirname, '../../data');
    return path.join(baseDir, 'stats', `ranch-${accountId || 'default'}.json`);
}

function loadRanchStats(accountId) {
    return readJsonFile(ranchStatsFilePath(accountId), null);
}

function saveRanchStats(accountId, data) {
    try { writeJsonFileAtomic(ranchStatsFilePath(accountId), data); } catch {}
}

module.exports = { ranchStatsFilePath, loadRanchStats, saveRanchStats };
