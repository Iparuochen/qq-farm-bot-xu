'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const https = require('node:https');
const http = require('node:http');
const nodeFetch = require('node-fetch');
const forge = require('node-forge');

// 测试隔离：避免读到本地真实的品赞配置。
const realDataDir = process.env.FARM_DATA_DIR;
const tempDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wx-proxy-test-'));
process.env.FARM_DATA_DIR = tempDataDir;
test.after(() => {
  if (realDataDir === undefined) delete process.env.FARM_DATA_DIR;
  else process.env.FARM_DATA_DIR = realDataDir;
  fs.rmSync(tempDataDir, { recursive: true, force: true });
});

const { parseProxyUrl, describeProxy, createTunnelSocket, createProxyAgents, resolveProxyForAccount, resolveProxyConfig } = require('../src/services/wx-login/proxy');

function selfSignedCertificate() {
  const pki = forge.pki;
  const keys = pki.rsa.generateKeyPair(2048);
  const cert = pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = '01';
  cert.validity.notBefore = new Date(Date.now() - 86400000);
  cert.validity.notAfter = new Date(Date.now() + 86400000);
  const attrs = [{ name: 'commonName', value: '127.0.0.1' }];
  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  cert.sign(keys.privateKey, forge.md.sha256.create());
  return { key: pki.privateKeyToPem(keys.privateKey), cert: pki.certificateToPem(cert) };
}

function listen(server) {
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server.address().port)));
}

function startEchoServer() {
  const server = net.createServer((socket) => {
    socket.pipe(socket);
  });
  return listen(server).then((port) => ({ server, port }));
}

const socketBuffers = new WeakMap();

function readBytes(reader, size) {
  return new Promise((resolve, reject) => {
    let buffer = socketBuffers.get(reader) || Buffer.alloc(0);
    const onData = (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);
      if (buffer.length >= size) finish();
    };
    const finish = () => {
      reader.removeListener('data', onData);
      reader.removeListener('error', onError);
      const out = buffer.subarray(0, size);
      socketBuffers.set(reader, buffer.subarray(size));
      resolve(out);
    };
    const onError = (error) => {
      reader.removeListener('data', onData);
      reader.removeListener('error', onError);
      reject(error);
    };
    reader.on('data', onData);
    reader.on('error', onError);
    if (buffer.length >= size) finish();
  });
}

function startSocks5Server(targetPort) {
  const server = net.createServer(async (client) => {
    try {
      const greeting = await readBytes(client, 2);
      const methods = await readBytes(client, greeting[1]);
      assert.equal(greeting[0], 0x05);
      client.write(Buffer.from([0x05, 0x00])); // 选择无认证
      assert.ok(methods.includes(0x00));
      const head = await readBytes(client, 4);
      assert.equal(head[1], 0x01);
      let host = '';
      if (head[3] === 0x01) {
        host = [...(await readBytes(client, 4))].join('.');
      } else if (head[3] === 0x03) {
        const length = (await readBytes(client, 1))[0];
        host = (await readBytes(client, length)).toString();
      }
      await readBytes(client, 2); // 端口
      assert.equal(host, '127.0.0.1');
      client.write(Buffer.from([0x05, 0x00, 0x00, 0x01, 127, 0, 0, 1, 0, 0]));
      const upstream = net.connect(targetPort, '127.0.0.1', () => {
        client.pipe(upstream);
        upstream.pipe(client);
      });
    } catch {
      client.destroy();
    }
  });
  return listen(server).then((port) => ({ server, port }));
}

function startHttpConnectServer(targetPort) {
  const server = net.createServer((client) => {
    let buffer = Buffer.alloc(0);
    const onData = (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);
      const index = buffer.indexOf('\r\n\r\n');
      if (index < 0) return;
      client.removeListener('data', onData);
      const head = buffer.subarray(0, index).toString();
      assert.match(head, /^CONNECT 127\.0\.0\.1:\d+ HTTP\/1\.1/);
      const rest = buffer.subarray(index + 4);
      client.write('HTTP/1.1 200 Connection Established\r\n\r\n');
      const upstream = net.connect(targetPort, '127.0.0.1', () => {
        if (rest.length) upstream.write(rest);
        client.pipe(upstream);
        upstream.pipe(client);
      });
    };
    client.on('data', onData);
  });
  return listen(server).then((port) => ({ server, port }));
}

function exchange(socket) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('tunnel echo timeout')), 3000);
    socket.once('data', (chunk) => {
      clearTimeout(timer);
      resolve(chunk.toString());
    });
    socket.once('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    socket.write('ping');
  });
}

test('parseProxyUrl supports socks5/http and redacts credentials', () => {
  const socks = parseProxyUrl('socks5://user:p%40ss@127.0.0.1:1080');
  assert.equal(socks.protocol, 'socks5');
  assert.equal(socks.host, '127.0.0.1');
  assert.equal(socks.port, 1080);
  assert.deepEqual(socks.auth, { username: 'user', password: 'p@ss' });
  assert.equal(describeProxy(socks), 'socks5://127.0.0.1:1080 (auth)');

  const http = parseProxyUrl('127.0.0.1:8080');
  assert.equal(http.protocol, 'http');
  assert.equal(http.port, 8080);

  assert.throws(() => parseProxyUrl('ftp://127.0.0.1:21'));
});

test('createTunnelSocket passes through a SOCKS5 proxy', async (t) => {
  const echo = await startEchoServer();
  const socks = await startSocks5Server(echo.port);
  t.after(() => {
    socks.server.close();
    echo.server.close();
  });

  const proxy = parseProxyUrl(`socks5://127.0.0.1:${socks.port}`);
  const socket = await createTunnelSocket({ host: '127.0.0.1', port: echo.port, proxy, timeout: 3000 });
  t.after(() => socket.destroy());
  assert.equal(await exchange(socket), 'ping');
});

test('createTunnelSocket passes through an HTTP CONNECT proxy', async (t) => {
  const echo = await startEchoServer();
  const connectProxy = await startHttpConnectServer(echo.port);
  t.after(() => {
    connectProxy.server.close();
    echo.server.close();
  });

  const proxy = parseProxyUrl(`http://127.0.0.1:${connectProxy.port}`);
  const socket = await createTunnelSocket({ host: '127.0.0.1', port: echo.port, proxy, timeout: 3000 });
  t.after(() => socket.destroy());
  assert.equal(await exchange(socket), 'ping');
});

test('createProxyAgents tunnels HTTPS through an HTTP CONNECT proxy', async (t) => {
  const { key, cert } = selfSignedCertificate();
  const httpsServer = https.createServer({ key, cert }, (req, res) => {
    res.writeHead(200, { 'content-type': 'text/plain' });
    res.end('ok');
  });
  const httpsPort = await listen(httpsServer);
  const connectProxy = await startHttpConnectServer(httpsPort);
  t.after(() => {
    connectProxy.server.close();
    httpsServer.close();
  });

  const agents = createProxyAgents(parseProxyUrl(`http://127.0.0.1:${connectProxy.port}`));
  t.after(() => {
    agents.httpAgent.destroy();
    agents.httpsAgent.destroy();
  });

  const body = await new Promise((resolve, reject) => {
    const req = https.request(
      { host: '127.0.0.1', port: httpsPort, path: '/', agent: agents.httpsAgent, rejectUnauthorized: false },
      (res) => {
        let out = '';
        res.on('data', (chunk) => (out += chunk));
        res.on('end', () => resolve(out));
      }
    );
    req.on('error', reject);
    req.end();
  });
  assert.equal(body, 'ok');
});

test('node-fetch with tunnel agent forwards headers and set-cookie through proxy', async (t) => {
  const target = http.createServer((req, res) => {
    res.writeHead(200, { 'content-type': 'application/json', 'set-cookie': 'openid=demo' });
    res.end(JSON.stringify(req.headers));
  });
  const targetPort = await listen(target);
  const connectProxy = await startHttpConnectServer(targetPort);
  t.after(() => {
    connectProxy.server.close();
    target.close();
  });

  const agents = createProxyAgents(parseProxyUrl(`http://127.0.0.1:${connectProxy.port}`));
  t.after(() => {
    agents.httpAgent.destroy();
    agents.httpsAgent.destroy();
  });

  const response = await nodeFetch(`http://127.0.0.1:${targetPort}/probe`, {
    headers: { 'user-agent': 'wx-proxy-test', cookie: 'openid=demo' },
    agent: (parsed) => (parsed.protocol === 'https:' ? agents.httpsAgent : agents.httpAgent),
  });
  const seen = await response.json();
  assert.equal(seen['user-agent'], 'wx-proxy-test');
  assert.equal(seen.cookie, 'openid=demo');
  assert.equal(response.headers.raw()['set-cookie'][0], 'openid=demo');
});

test('resolveProxyConfig honors explicit direct/static selection', async () => {
  const keys = ['YYB_PINZAN_NO', 'YYB_PINZAN_SECRET', 'WX_LOGIN_PROXY'];
  const saved = keys.map((key) => [key, process.env[key]]);
  for (const key of keys) delete process.env[key];
  try {
    process.env.WX_LOGIN_PROXY = 'socks5://127.0.0.1:1080';
    assert.equal(await resolveProxyConfig({ mode: 'direct' }), null);
    assert.equal((await resolveProxyConfig({ mode: 'static', url: 'http://10.0.0.2:8080' })).port, 8080);
    await assert.rejects(() => resolveProxyConfig({ mode: 'static', url: '' }), /静态代理地址/);
    await assert.rejects(() => resolveProxyConfig({ mode: 'pinzan' }), /品赞代理未配置/);
    assert.equal(await resolveProxyForAccount({ wxProxyMode: 'direct' }), null);
  }
  finally {
    for (const [key, value] of saved) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test('resolveProxyForAccount is direct by default and prefers account override', async () => {
  const keys = ['WX_LOGIN_PROXY', 'YYB_PINZAN_NO', 'YYB_PINZAN_SECRET'];
  const saved = keys.map((key) => [key, process.env[key]]);
  for (const key of keys) delete process.env[key];
  try {
    assert.equal(await resolveProxyForAccount({}), null);
    process.env.WX_LOGIN_PROXY = 'socks5://127.0.0.1:1080';
    assert.equal((await resolveProxyForAccount({})).host, '127.0.0.1');
    assert.equal((await resolveProxyForAccount({ wxProxy: 'http://10.0.0.1:9000' })).port, 9000);
  }
  finally {
    for (const [key, value] of saved) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
