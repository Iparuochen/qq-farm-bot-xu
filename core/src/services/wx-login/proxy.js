'use strict';

// yyb 登录链路的可选代理出口（只用于微信扫码/OAuth/login_buffer/refresh/MMTLS 取 code）。
// 默认不配置任何环境变量时返回 null，调用方走原来的直连逻辑，行为与改动前完全一致。
//
// 支持的静态代理（环境变量 WX_LOGIN_PROXY 或账号字段 wxProxy）：
//   socks5://user:pass@host:port    socks5h://host:port
//   http://user:pass@host:port      https://user:pass@host:port（TLS 到代理）
//   也接受裸 host:port（按 http-connect 处理）
//
// 品赞动态优质池（需要先在品赞后台把本机公网出口 IP 加入套餐白名单）：
//   YYB_PINZAN_NO        套餐购买编号
//   YYB_PINZAN_SECRET    提取密钥
//   YYB_PINZAN_AREA      地区编码，默认 all（如深圳 440300）
//   YYB_PINZAN_MINUTE    提取时长 1/3/5/10/15/30，默认 1
//   YYB_PINZAN_PROTOCOL  1=HTTP，2=SOCKS5，默认 1
//
// 代理不可用时的策略（WX_LOGIN_PROXY_FALLBACK）：
//   direct（默认）—— 记录告警并回退直连，优先保证已登录账号不掉线
//   strict        —— 抛错，保证出口 IP 不跳变

const net = require('node:net');
const tls = require('node:tls');
const http = require('node:http');
const https = require('node:https');
const nodeFetch = require('node-fetch');
const { loadPinzanRuntimeConfig } = require('./pinzan-config');

const DEFAULT_TIMEOUT = 8000;
const PINZAN_HEALTH_URL = 'https://open.weixin.qq.com/';
const PINZAN_MAX_CANDIDATES = 3;
const PINZAN_CACHE_SKEW_MS = 5000;

function logWarn(message, detail) {
  if (detail === undefined) console.warn(`[wx-proxy] ${message}`);
  else console.warn(`[wx-proxy] ${message}`, detail);
}

function parseProxyUrl(raw) {
  const text = String(raw || '').trim();
  if (!text) return null;
  const normalized = /^[a-z0-9+.-]+:\/\//i.test(text) ? text : `http://${text}`;
  const url = new URL(normalized);
  let protocol = url.protocol.replace(':', '').toLowerCase();
  if (protocol === 'socks' || protocol === 'socks5h') protocol = 'socks5';
  if (!['socks5', 'http', 'https', 'http-connect'].includes(protocol)) {
    throw new Error(`不支持的代理协议: ${url.protocol}`);
  }
  if (protocol === 'http-connect') protocol = 'http';
  const defaultPort = protocol === 'socks5' ? 1080 : 80;
  const port = Number(url.port || defaultPort);
  if (!url.hostname || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('代理地址或端口无效');
  }
  return {
    url: normalized,
    protocol,
    host: url.hostname,
    port,
    auth: url.username
      ? {
          username: decodeURIComponent(url.username),
          password: decodeURIComponent(url.password || ''),
        }
      : null,
  };
}

function describeProxy(proxy) {
  if (!proxy) return 'direct';
  return `${proxy.protocol}://${proxy.host}:${proxy.port}${proxy.auth ? ' (auth)' : ''}`;
}

function connectSocket(host, port, timeout) {
  return new Promise((resolve, reject) => {
    const socket = net.connect({ host, port });
    const timer = setTimeout(() => {
      socket.destroy();
      reject(new Error(`代理连接超时 ${host}:${port}`));
    }, timeout);
    socket.once('connect', () => {
      clearTimeout(timer);
      resolve(socket);
    });
    socket.once('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

function wrapTls(socket, servername, timeout) {
  return new Promise((resolve, reject) => {
    const secure = tls.connect({ socket, servername, ALPNProtocols: ['http/1.1'] });
    const timer = setTimeout(() => {
      secure.destroy();
      reject(new Error(`代理 TLS 握手超时 ${servername}`));
    }, timeout);
    secure.once('secureConnect', () => {
      clearTimeout(timer);
      resolve(secure);
    });
    secure.once('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

// 顺序读取代理握手响应的缓冲区，避免多次挂 data 监听时丢数据。
function createReader(socket) {
  let buffer = Buffer.alloc(0);
  let version = 0;
  let closed = false;
  let failure = null;
  const waiters = [];

  function flush() {
    while (waiters.length) {
      const waiter = waiters[0];
      if (waiter.size > 0 && buffer.length >= waiter.size) {
        const out = buffer.subarray(0, waiter.size);
        buffer = buffer.subarray(waiter.size);
        waiters.shift();
        waiter.resolve(out);
      } else if (waiter.size < 0 && (version > waiter.version || closed || failure)) {
        waiters.shift();
        waiter.resolve();
      } else if (failure) {
        waiters.shift();
        waiter.reject(failure);
      } else if (closed) {
        waiters.shift();
        waiter.reject(new Error('代理连接已关闭'));
      } else {
        break;
      }
    }
  }

  const onData = (chunk) => {
    buffer = Buffer.concat([buffer, Buffer.from(chunk)]);
    version += 1;
    flush();
  };
  const onEnd = () => {
    closed = true;
    flush();
  };
  const onError = (error) => {
    failure = error;
    flush();
  };

  socket.on('data', onData);
  socket.on('end', onEnd);
  socket.on('error', onError);

  return {
    read(size) {
      return new Promise((resolve, reject) => {
        waiters.push({ size, resolve, reject });
        flush();
      });
    },
    async readUntil(token) {
      for (;;) {
        const index = buffer.indexOf(token);
        if (index >= 0) {
          const out = buffer.subarray(0, index + token.length);
          buffer = buffer.subarray(index + token.length);
          return out;
        }
        if (failure) throw failure;
        if (closed) throw new Error('代理连接已关闭');
        await new Promise((resolve, reject) => {
          waiters.push({ size: -1, version, resolve, reject });
          flush();
        });
      }
    },
    detach() {
      socket.removeListener('data', onData);
      socket.removeListener('end', onEnd);
      socket.removeListener('error', onError);
      const rest = buffer;
      buffer = Buffer.alloc(0);
      return rest;
    },
  };
}

function socks5Target(host) {
  if (net.isIPv4(host)) return Buffer.from([0x01, ...host.split('.').map(Number)]);
  const name = Buffer.from(host);
  if (name.length > 255) throw new Error('SOCKS5 目标域名过长');
  return Buffer.concat([Buffer.from([0x03, name.length]), name]);
}

async function socks5Tunnel(proxy, host, port, timeout) {
  let socket = await connectSocket(proxy.host, proxy.port, timeout);
  if (proxy.protocol === 'https') socket = await wrapTls(socket, proxy.host, timeout);
  socket.setTimeout(timeout, () => socket.destroy(new Error('SOCKS5 握手超时')));
  const reader = createReader(socket);
  try {
    const methods = proxy.auth ? [0x00, 0x02] : [0x00];
    socket.write(Buffer.from([0x05, methods.length, ...methods]));
    const greeting = await reader.read(2);
    if (greeting[0] !== 0x05) throw new Error('SOCKS5 版本无效');
    if (greeting[1] === 0x02) {
      const username = Buffer.from(proxy.auth.username);
      const password = Buffer.from(proxy.auth.password);
      socket.write(
        Buffer.concat([
          Buffer.from([0x01, username.length]),
          username,
          Buffer.from([password.length]),
          password,
        ])
      );
      const authReply = await reader.read(2);
      if (authReply[1] !== 0x00) throw new Error('SOCKS5 认证失败');
    } else if (greeting[1] !== 0x00) {
      throw new Error(`SOCKS5 不支持认证方式 ${greeting[1]}`);
    }
    socket.write(
      Buffer.concat([
        Buffer.from([0x05, 0x01, 0x00]),
        socks5Target(host),
        Buffer.from([port >> 8, port & 0xFF]),
      ])
    );
    const reply = await reader.read(4);
    if (reply[1] !== 0x00) throw new Error(`SOCKS5 CONNECT 失败 (${reply[1]})`);
    let skip = 0;
    if (reply[3] === 0x01) skip = 4;
    else if (reply[3] === 0x03) skip = (await reader.read(1))[0];
    else if (reply[3] === 0x04) skip = 16;
    else throw new Error('SOCKS5 地址类型无效');
    if (skip) await reader.read(skip);
    await reader.read(2);
    const leftover = reader.detach();
    socket.setTimeout(0);
    if (leftover.length) socket.unshift(leftover);
    return socket;
  } catch (error) {
    reader.detach();
    socket.destroy();
    throw error;
  }
}

async function httpConnectTunnel(proxy, host, port, timeout) {
  let socket = await connectSocket(proxy.host, proxy.port, timeout);
  if (proxy.protocol === 'https') socket = await wrapTls(socket, proxy.host, timeout);
  socket.setTimeout(timeout, () => socket.destroy(new Error('HTTP CONNECT 握手超时')));
  const reader = createReader(socket);
  try {
    const authority = `${host}:${port}`;
    const lines = [`CONNECT ${authority} HTTP/1.1`, `Host: ${authority}`];
    if (proxy.auth) {
      const token = Buffer.from(`${proxy.auth.username}:${proxy.auth.password}`).toString('base64');
      lines.push(`Proxy-Authorization: Basic ${token}`);
    }
    lines.push('Connection: keep-alive', '', '');
    socket.write(lines.join('\r\n'));
    const head = (await reader.readUntil(Buffer.from('\r\n\r\n'))).toString('latin1');
    const status = Number((head.match(/^HTTP\/\d\.\d\s+(\d{3})/) || [])[1]);
    if (status !== 200) throw new Error(`HTTP CONNECT 失败 (HTTP ${status || 'unknown'})`);
    const leftover = reader.detach();
    socket.setTimeout(0);
    if (leftover.length) socket.unshift(leftover);
    return socket;
  } catch (error) {
    reader.detach();
    socket.destroy();
    throw error;
  }
}

async function createTunnelSocket({ host, port, proxy, timeout = DEFAULT_TIMEOUT }) {
  if (!proxy) return connectSocket(host, port, timeout);
  if (proxy.protocol === 'socks5') return socks5Tunnel(proxy, host, port, timeout);
  return httpConnectTunnel(proxy, host, port, timeout);
}

// node-fetch 用的 http/https Agent：先与代理建隧道，HTTPS 再在隧道上做 TLS。
function createProxyAgents(proxy, options = {}) {
  const timeout = options.timeout || DEFAULT_TIMEOUT;

  class TunnelHttpAgent extends http.Agent {
    createConnection(requestOptions, callback) {
      createTunnelSocket({
        host: requestOptions.host,
        port: Number(requestOptions.port) || 80,
        proxy,
        timeout,
      }).then((socket) => callback(null, socket), callback);
      return undefined;
    }
  }

  class TunnelHttpsAgent extends https.Agent {
    createConnection(requestOptions, callback) {
      createTunnelSocket({
        host: requestOptions.host,
        port: Number(requestOptions.port) || 443,
        proxy,
        timeout,
      }).then((socket) => {
        const secure = tls.connect(
          {
            socket,
            servername: requestOptions.servername || requestOptions.host,
            ALPNProtocols: ['http/1.1'],
            rejectUnauthorized: requestOptions.rejectUnauthorized !== false,
          },
          () => callback(null, secure)
        );
        secure.once('error', callback);
      }, callback);
      return undefined;
    }
  }

  return {
    httpAgent: new TunnelHttpAgent({ keepAlive: true }),
    httpsAgent: new TunnelHttpsAgent({ keepAlive: true }),
  };
}

function pinzanConfig() {
  // 前端保存的凭证优先，环境变量兜底（见 pinzan-config.js）。
  return loadPinzanRuntimeConfig();
}

async function extractPinzanProxy(config, area, timeout) {
  const url = new URL(config.extractUrl);
  url.searchParams.set('no', config.no);
  url.searchParams.set('secret', config.secret);
  url.searchParams.set('num', '1');
  url.searchParams.set('mode', 'whitelist');
  url.searchParams.set('format', 'json');
  url.searchParams.set('protocol', String(config.protocol));
  url.searchParams.set('pool', 'quality');
  url.searchParams.set('minute', String(config.minute));
  if (area) url.searchParams.set('area', area);

  const response = await nodeFetch(url.toString(), { signal: AbortSignal.timeout(timeout) });
  if (response.status !== 200) throw new Error(`品赞提取 HTTP ${response.status}`);
  const data = await response.json();
  if (!data || data.code !== 0) {
    const message = [data && data.msg, data && data.message, data && data.info].find(Boolean) || `code=${data && data.code}`;
    let hint = '';
    if (/套餐不存在/.test(message))
      hint = '（请确认品赞后台已购买优质池套餐，并填写"套餐编号"，不是订单号或用户ID）';
    else if (/白名单|未授权|IP/i.test(message))
      hint = '（请把运行 bot 的机器公网出口 IP 加入该套餐白名单）';
    else if (/余额不足/.test(message))
      hint = '（品赞账户余额不足，请先充值）';
    throw new Error(`品赞提取失败: ${message}${hint}`);
  }
  const item = data.data && Array.isArray(data.data.list) ? data.data.list[0] : null;
  const host = String((item && (item.host || item.ip)) || '').trim();
  const port = Number(item && item.port);
  if (!host || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('品赞提取返回的地址或端口无效');
  }
  return parseProxyUrl(`${config.protocol === 2 ? 'socks5' : 'http'}://${host}:${port}`);
}

async function checkProxy(proxy, timeout) {
  const agents = createProxyAgents(proxy, { timeout });
  try {
    const response = await nodeFetch(PINZAN_HEALTH_URL, {
      agent: (parsed) => (parsed.protocol === 'https:' ? agents.httpsAgent : agents.httpAgent),
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(timeout),
    });
    return response.status >= 200 && response.status < 400;
  } catch {
    return false;
  } finally {
    agents.httpAgent.destroy();
    agents.httpsAgent.destroy();
  }
}

const pinzanCache = new Map();
const pinzanInflight = new Map();

// 前端保存新凭证后清空旧提取缓存，避免继续复用旧套餐的出口。
function clearPinzanProxyCache() {
  pinzanCache.clear();
}

function cachedPinzanProxy(config, area, timeout) {
  const key = `${config.no}|${area}|${config.minute}|${config.protocol}`;
  const hit = pinzanCache.get(key);
  if (hit && hit.expiresAt - PINZAN_CACHE_SKEW_MS > Date.now()) return Promise.resolve(hit.proxy);
  const inflight = pinzanInflight.get(key);
  if (inflight) return inflight;

  const task = (async () => {
    let lastError = null;
    for (let attempt = 1; attempt <= PINZAN_MAX_CANDIDATES; attempt += 1) {
      try {
        const proxy = await extractPinzanProxy(config, area, timeout);
        if (await checkProxy(proxy, timeout)) {
          pinzanCache.set(key, { proxy, expiresAt: Date.now() + config.minute * 60000 });
          return proxy;
        }
        lastError = new Error('品赞代理健康检查失败');
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError || new Error('品赞代理提取失败');
  })().finally(() => pinzanInflight.delete(key));

  pinzanInflight.set(key, task);
  return task;
}

function fallbackEnabled() {
  return String(process.env.WX_LOGIN_PROXY_FALLBACK || 'direct').trim().toLowerCase() !== 'strict';
}

function handleProxyError(error) {
  if (!fallbackEnabled()) throw error;
  logWarn(`代理不可用，回退直连: ${error instanceof Error ? error.message : String(error)}`);
  return null;
}

// 账号级 wxProxyMode/wxProxy/wxProxyArea 优先，其次全局 WX_LOGIN_PROXY，最后品赞动态池；都没有则返回 null。
async function resolveProxyForAccount(account = {}) {
  const mode = String((account && account.wxProxyMode) || '').trim().toLowerCase();
  if (mode === 'direct') return null;
  if (mode === 'pinzan') {
    const pinzan = pinzanConfig();
    if (!pinzan) return handleProxyError(new Error('品赞代理未配置：请设置 YYB_PINZAN_NO 和 YYB_PINZAN_SECRET'));
    const area = String((account && account.wxProxyArea) || pinzan.area || 'all').trim() || 'all';
    try {
      return await cachedPinzanProxy(pinzan, area, DEFAULT_TIMEOUT);
    } catch (error) {
      return handleProxyError(error);
    }
  }
  const explicit = String((account && account.wxProxy) || process.env.WX_LOGIN_PROXY || '').trim();
  if (explicit) {
    try {
      return parseProxyUrl(explicit);
    } catch (error) {
      return handleProxyError(error);
    }
  }
  // 未显式选择代理时一律直连：全局品赞配置只服务扫码页的手动选择，
  // 不再作为兜底，避免已登录账号的后台保活或定时任务消耗动态代理。
  return null;
}

// 扫码页显式选择的出口：direct/static/pinzan。用户主动选择时不静默回退直连，失败直接返回错误。
async function resolveProxyConfig(input = {}) {
  const mode = String((input && input.mode) || '').trim().toLowerCase();
  if (mode === 'direct') return null;
  if (mode === 'static') {
    const parsed = parseProxyUrl(input.url);
    if (!parsed) throw new Error('请填写静态代理地址');
    return parsed;
  }
  if (mode === 'pinzan') {
    const config = pinzanConfig();
    if (!config) throw new Error('品赞代理未配置：请先设置 YYB_PINZAN_NO 和 YYB_PINZAN_SECRET');
    const area = String(input.area || config.area || 'all').trim() || 'all';
    return cachedPinzanProxy(config, area, DEFAULT_TIMEOUT);
  }
  return resolveProxyForAccount({});
}

module.exports = {
  parseProxyUrl,
  describeProxy,
  createTunnelSocket,
  createProxyAgents,
  resolveProxyForAccount,
  resolveProxyConfig,
  clearPinzanProxyCache,
};
