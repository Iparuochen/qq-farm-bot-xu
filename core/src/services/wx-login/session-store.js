'use strict';

// MMTLS 会话的持久化缓存（进程重启后可复用，减少完整握手）。
// 内容含 sendKey/recvKey/ticket/psk 等会话密钥，落盘前用 AES-256-GCM 加密；
// 密钥文件与会话文件都放在 data 目录，权限 0600。
// 任何读写/解密失败都只告警并退回内存缓存，绝不阻断登录。

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const MAGIC = Buffer.from('WXSC1');
const IV_BYTES = 12;
const TAG_BYTES = 16;

function encodeValue(value) {
  if (Buffer.isBuffer(value)) return { $b64: value.toString('base64') };
  if (typeof value === 'bigint') return { $bigint: value.toString() };
  return value;
}

function decodeValue(value) {
  if (value && typeof value === 'object') {
    if (typeof value.$b64 === 'string') return Buffer.from(value.$b64, 'base64');
    if (typeof value.$bigint === 'string') return BigInt(value.$bigint);
  }
  return value;
}

function serializeSession(session) {
  const out = {};
  for (const [name, value] of Object.entries(session || {})) out[name] = encodeValue(value);
  return out;
}

function deserializeSession(raw) {
  const out = {};
  for (const [name, value] of Object.entries(raw || {})) out[name] = decodeValue(value);
  return out;
}

function loadKey(keyFile) {
  try {
    const raw = fs.readFileSync(keyFile);
    if (raw.length === 32) return raw;
    const text = raw.toString('utf8').trim();
    if (/^[0-9a-f]{64}$/i.test(text)) return Buffer.from(text, 'hex');
  } catch {
    // 密钥不存在或不可读，下面重新生成
  }
  const key = crypto.randomBytes(32);
  fs.writeFileSync(keyFile, key.toString('hex'), { mode: 0o600 });
  return key;
}

function encrypt(key, payload) {
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(payload), cipher.final()]);
  return Buffer.concat([MAGIC, iv, cipher.getAuthTag(), encrypted]);
}

function decrypt(key, blob) {
  if (!Buffer.isBuffer(blob) || blob.length < MAGIC.length + IV_BYTES + TAG_BYTES) {
    throw new Error('会话缓存文件格式无效');
  }
  if (!blob.subarray(0, MAGIC.length).equals(MAGIC)) throw new Error('会话缓存文件标识无效');
  const iv = blob.subarray(MAGIC.length, MAGIC.length + IV_BYTES);
  const tag = blob.subarray(MAGIC.length + IV_BYTES, MAGIC.length + IV_BYTES + TAG_BYTES);
  const body = blob.subarray(MAGIC.length + IV_BYTES + TAG_BYTES);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(body), decipher.final()]);
}

class SessionStore {
  constructor({ file, keyFile, ttlMs = 30 * 60000, maxEntries = 64, logger = console } = {}) {
    this.file = file;
    this.keyFile = keyFile;
    this.ttlMs = ttlMs;
    this.maxEntries = maxEntries;
    this.logger = logger;
    this.entries = new Map();
    this.key = null;
    this.load();
  }

  enabled() {
    return Boolean(this.file && this.keyFile && this.ttlMs > 0);
  }

  load() {
    if (!this.enabled() || !fs.existsSync(this.file)) return;
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      this.key = loadKey(this.keyFile);
      const parsed = JSON.parse(decrypt(this.key, fs.readFileSync(this.file)).toString('utf8'));
      if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.entries)) return;
      const now = Date.now();
      for (const entry of parsed.entries) {
        if (!entry || typeof entry.key !== 'string' || typeof entry.at !== 'number') continue;
        if (this.ttlMs > 0 && now - entry.at >= this.ttlMs) continue;
        this.entries.set(entry.key, { session: deserializeSession(entry.session), at: entry.at });
      }
      this.prune(now);
    } catch (error) {
      this.logger.warn?.(`[wx-session-cache] 读取失败，使用空缓存: ${error instanceof Error ? error.message : String(error)}`);
      this.entries.clear();
    }
  }

  prune(now = Date.now()) {
    if (this.ttlMs > 0) {
      for (const [key, entry] of this.entries) {
        if (now - entry.at >= this.ttlMs) this.entries.delete(key);
      }
    }
    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) break;
      this.entries.delete(oldest);
    }
  }

  get(key) {
    if (!this.enabled()) return null;
    const entry = this.entries.get(key);
    if (!entry) return null;
    if (this.ttlMs > 0 && Date.now() - entry.at >= this.ttlMs) {
      this.delete(key);
      return null;
    }
    return entry;
  }

  set(key, session) {
    if (!this.enabled()) return;
    this.entries.delete(key);
    this.entries.set(key, { session, at: Date.now() });
    this.prune();
    this.save();
  }

  delete(key) {
    if (!this.entries.delete(key)) return;
    this.save();
  }

  save() {
    if (!this.enabled()) return;
    try {
      if (!this.key) {
        fs.mkdirSync(path.dirname(this.keyFile), { recursive: true });
        this.key = loadKey(this.keyFile);
      }
      const entries = [...this.entries].map(([key, entry]) => ({
        key,
        at: entry.at,
        session: serializeSession(entry.session),
      }));
      const payload = Buffer.from(JSON.stringify({ version: 1, entries }), 'utf8');
      const tmp = `${this.file}.tmp`;
      fs.writeFileSync(tmp, encrypt(this.key, payload), { mode: 0o600 });
      try {
        fs.renameSync(tmp, this.file);
      } catch {
        // Windows 上偶发 rename 失败时退回直接写入
        fs.writeFileSync(this.file, encrypt(this.key, payload), { mode: 0o600 });
        try { fs.unlinkSync(tmp); } catch { /* ignore */ }
      }
    } catch (error) {
      this.logger.warn?.(`[wx-session-cache] 写入失败，仅保留内存缓存: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

module.exports = { SessionStore, loadKey, encrypt, decrypt };
