'use strict';

// 品赞代理凭证的服务端存储：前端设置优先，环境变量兜底。
// 凭证加密保存在 data 目录（与 MMTLS 会话缓存同一套 AES-256-GCM 机制），接口只返回脱敏值。

const fs = require('node:fs');
const { ensureDataDir, getDataFile } = require('../../config/runtime-paths');
const { loadKey, encrypt, decrypt } = require('./session-store');

const CONFIG_FILE = 'pinzan-config.bin';
const KEY_FILE = 'pinzan-secret.key';

function warn(message) {
  console.warn(`[pinzan-config] ${message}`);
}

function envNumber(name, fallback, min, max) {
  const value = Number(process.env[name]);
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(value)));
}

function readStored() {
  const file = getDataFile(CONFIG_FILE);
  if (!fs.existsSync(file)) return null;
  try {
    const key = loadKey(getDataFile(KEY_FILE));
    const parsed = JSON.parse(decrypt(key, fs.readFileSync(file)).toString('utf8'));
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch (error) {
    warn(`读取配置失败: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

function writeStored(data) {
  ensureDataDir();
  const file = getDataFile(CONFIG_FILE);
  const key = loadKey(getDataFile(KEY_FILE));
  const payload = Buffer.from(JSON.stringify({ version: 1, ...data }), 'utf8');
  const blob = encrypt(key, payload);
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, blob, { mode: 0o600 });
  try {
    fs.renameSync(tmp, file);
  } catch {
    fs.writeFileSync(file, blob, { mode: 0o600 });
    try { fs.unlinkSync(tmp); } catch { /* ignore */ }
  }
}

function runtimeProtocol(stored) {
  const raw = stored && stored.protocol !== undefined
    ? stored.protocol
    : (String(process.env.YYB_PINZAN_PROTOCOL || '1') === '2' ? 2 : 1);
  return Number(raw) === 2 ? 2 : 1;
}

/** 运行时代理配置：字段级「存储优先，环境变量兜底」；未配置返回 null。 */
function loadPinzanRuntimeConfig() {
  const stored = readStored() || {};
  const no = String(stored.no || process.env.YYB_PINZAN_NO || '').trim();
  const secret = String(stored.secret || process.env.YYB_PINZAN_SECRET || '').trim();
  if (!no || !secret) return null;
  return {
    no,
    secret,
    area: String(stored.area || process.env.YYB_PINZAN_AREA || 'all').trim() || 'all',
    minute: Number.isFinite(Number(stored.minute))
      ? Math.min(30, Math.max(1, Math.trunc(Number(stored.minute))))
      : envNumber('YYB_PINZAN_MINUTE', 1, 1, 30),
    protocol: runtimeProtocol(stored),
    extractUrl: String(process.env.YYB_PINZAN_EXTRACT_URL || 'https://service.ipzan.com/core-extract').trim(),
  };
}

function maskSecret(secret) {
  const text = String(secret || '');
  if (!text) return '';
  if (text.length <= 4) return '****';
  return `${'*'.repeat(Math.min(8, text.length - 4))}${text.slice(-4)}`;
}

/** 给前端展示的配置（永不返回明文密钥）。 */
function getPinzanSettings() {
  const stored = readStored() || {};
  const no = String(stored.no || process.env.YYB_PINZAN_NO || '').trim();
  const secret = String(stored.secret || process.env.YYB_PINZAN_SECRET || '').trim();
  const source = stored.no ? 'file' : (no && secret ? 'env' : 'none');
  return {
    configured: Boolean(no && secret),
    no,
    secretConfigured: Boolean(secret),
    secretMasked: maskSecret(secret),
    area: String(stored.area || process.env.YYB_PINZAN_AREA || 'all').trim() || 'all',
    minute: Number.isFinite(Number(stored.minute))
      ? Math.min(30, Math.max(1, Math.trunc(Number(stored.minute))))
      : envNumber('YYB_PINZAN_MINUTE', 1, 1, 30),
    protocol: runtimeProtocol(stored),
    source,
  };
}

/** 保存前端提交的配置；secret 留空表示沿用已有密钥。 */
function savePinzanSettings(input = {}) {
  if (input && input.clear === true) {
    const file = getDataFile(CONFIG_FILE);
    if (fs.existsSync(file)) fs.unlinkSync(file);
    return getPinzanSettings();
  }
  const current = readStored() || {};
  const no = String(input.no || current.no || '').trim();
  if (!no) throw new Error('请填写品赞套餐编号');
  const secret = String(input.secret || '').trim()
    || String(current.secret || process.env.YYB_PINZAN_SECRET || '').trim();
  if (!secret) throw new Error('请填写品赞提取密钥');
  const area = String(input.area || current.area || process.env.YYB_PINZAN_AREA || 'all').trim() || 'all';
  const minute = Math.min(30, Math.max(1, Math.trunc(Number(input.minute ?? current.minute ?? envNumber('YYB_PINZAN_MINUTE', 1, 1, 30)))));
  const protocol = Number(input.protocol ?? current.protocol ?? runtimeProtocol(null)) === 2 ? 2 : 1;
  writeStored({ no, secret, area, minute, protocol });
  return getPinzanSettings();
}

module.exports = {
  loadPinzanRuntimeConfig,
  getPinzanSettings,
  savePinzanSettings,
};
