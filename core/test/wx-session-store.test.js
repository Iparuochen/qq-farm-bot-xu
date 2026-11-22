'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { SessionStore } = require('../src/services/wx-login/session-store');

function tempDir(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wx-session-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

function sampleSession() {
  return {
    sendKey: Buffer.from('send-key-bytes'),
    recvKey: Buffer.from('recv-key-bytes'),
    f9: Buffer.from('f9'),
    uin: 123456789n,
    deviceId: Buffer.from('device'),
    hostAppId: 'wx123',
    psk: Buffer.alloc(32, 7),
    ticket: Buffer.from('ticket-bytes'),
  };
}

test('session store persists encrypted entries across instances', (t) => {
  const dir = tempDir(t);
  const file = path.join(dir, 'wx-session-cache.bin');
  const keyFile = path.join(dir, 'wx-session-cache.key');

  const first = new SessionStore({ file, keyFile, ttlMs: 60000 });
  first.set('account:1|direct', sampleSession());
  assert.ok(fs.existsSync(file));
  assert.ok(fs.existsSync(keyFile));

  const raw = fs.readFileSync(file);
  assert.equal(raw.subarray(0, 5).toString(), 'WXSC1');
  assert.equal(raw.includes(Buffer.from('send-key-bytes')), false);

  const second = new SessionStore({ file, keyFile, ttlMs: 60000 });
  const loaded = second.get('account:1|direct');
  assert.ok(loaded);
  assert.deepEqual(loaded.session.sendKey, Buffer.from('send-key-bytes'));
  assert.equal(loaded.session.uin, 123456789n);
  assert.deepEqual(loaded.session.psk, Buffer.alloc(32, 7));
});

test('session store drops expired entries on load', async (t) => {
  const dir = tempDir(t);
  const file = path.join(dir, 'cache.bin');
  const keyFile = path.join(dir, 'cache.key');

  const first = new SessionStore({ file, keyFile, ttlMs: 20 });
  first.set('account:2|direct', sampleSession());
  await new Promise((resolve) => setTimeout(resolve, 30));

  const second = new SessionStore({ file, keyFile, ttlMs: 20 });
  assert.equal(second.get('account:2|direct'), null);
});

test('session store survives corrupted files and delete persists', (t) => {
  const dir = tempDir(t);
  const file = path.join(dir, 'cache.bin');
  const keyFile = path.join(dir, 'cache.key');
  fs.writeFileSync(file, 'not-a-valid-cache');

  const store = new SessionStore({ file, keyFile, ttlMs: 60000 });
  assert.equal(store.get('account:3|direct'), null);
  store.set('account:3|direct', sampleSession());

  const reloaded = new SessionStore({ file, keyFile, ttlMs: 60000 });
  assert.ok(reloaded.get('account:3|direct'));
  reloaded.delete('account:3|direct');

  const afterDelete = new SessionStore({ file, keyFile, ttlMs: 60000 });
  assert.equal(afterDelete.get('account:3|direct'), null);
});

test('session store is disabled when ttl is zero', (t) => {
  const dir = tempDir(t);
  const store = new SessionStore({ file: path.join(dir, 'cache.bin'), keyFile: path.join(dir, 'cache.key'), ttlMs: 0 });
  store.set('account:4|direct', sampleSession());
  assert.equal(store.get('account:4|direct'), null);
  assert.equal(fs.existsSync(path.join(dir, 'cache.bin')), false);
});
