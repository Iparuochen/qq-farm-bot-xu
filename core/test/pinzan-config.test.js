'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { loadPinzanRuntimeConfig, getPinzanSettings, savePinzanSettings } = require('../src/services/wx-login/pinzan-config');

const ENV_KEYS = ['YYB_PINZAN_NO', 'YYB_PINZAN_SECRET', 'YYB_PINZAN_AREA', 'YYB_PINZAN_MINUTE', 'YYB_PINZAN_PROTOCOL', 'FARM_DATA_DIR'];

function setup(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pinzan-'));
  const saved = ENV_KEYS.map((key) => [key, process.env[key]]);
  for (const key of ENV_KEYS) delete process.env[key];
  process.env.FARM_DATA_DIR = dir;
  t.after(() => {
    for (const [key, value] of saved) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    fs.rmSync(dir, { recursive: true, force: true });
  });
  return dir;
}

test('saves encrypted pinzan credentials and never returns the secret', (t) => {
  const dir = setup(t);
  const saved = savePinzanSettings({ no: 'ABC123', secret: 'topsecret9876', area: '440300', minute: 5, protocol: 1 });

  assert.equal(saved.configured, true);
  assert.equal(saved.no, 'ABC123');
  assert.equal(saved.secretMasked.endsWith('9876'), true);
  assert.equal(saved.source, 'file');
  assert.equal(JSON.stringify(saved).includes('topsecret'), false);

  const blob = fs.readFileSync(path.join(dir, 'pinzan-config.bin'));
  assert.equal(blob.includes(Buffer.from('topsecret')), false);
  assert.ok(fs.existsSync(path.join(dir, 'pinzan-secret.key')));

  const runtime = loadPinzanRuntimeConfig();
  assert.equal(runtime.no, 'ABC123');
  assert.equal(runtime.secret, 'topsecret9876');
  assert.equal(runtime.area, '440300');
  assert.equal(runtime.minute, 5);
});

test('stored credentials take precedence over environment variables', (t) => {
  setup(t);
  process.env.YYB_PINZAN_NO = 'ENV-NO';
  process.env.YYB_PINZAN_SECRET = 'ENV-SECRET';
  assert.equal(loadPinzanRuntimeConfig().no, 'ENV-NO');

  savePinzanSettings({ no: 'FILE-NO', secret: 'FILE-SECRET' });
  const runtime = loadPinzanRuntimeConfig();
  assert.equal(runtime.no, 'FILE-NO');
  assert.equal(runtime.secret, 'FILE-SECRET');
});

test('falls back to environment when nothing is stored', (t) => {
  setup(t);
  process.env.YYB_PINZAN_NO = 'ENV-NO';
  process.env.YYB_PINZAN_SECRET = 'ENV-SECRET';
  process.env.YYB_PINZAN_AREA = '310000';
  const settings = getPinzanSettings();
  assert.equal(settings.configured, true);
  assert.equal(settings.source, 'env');
  assert.equal(settings.area, '310000');
  assert.equal(settings.secretMasked.endsWith('CRET'), true);
});

test('rejects missing number and keeps existing secret when left blank', (t) => {
  setup(t);
  assert.throws(() => savePinzanSettings({ secret: 'x' }), /套餐编号/);
  savePinzanSettings({ no: 'ABC', secret: 'keepme1234' });
  const updated = savePinzanSettings({ no: 'ABC', secret: '', area: '440300' });
  assert.equal(updated.configured, true);
  assert.equal(loadPinzanRuntimeConfig().secret, 'keepme1234');
});

test('clear removes stored credentials and falls back to direct until env exists', (t) => {
  const dir = setup(t);
  savePinzanSettings({ no: 'ABC', secret: 'secret' });
  const cleared = savePinzanSettings({ clear: true });
  assert.equal(cleared.configured, false);
  assert.equal(fs.existsSync(path.join(dir, 'pinzan-config.bin')), false);
  assert.equal(loadPinzanRuntimeConfig(), null);
});
