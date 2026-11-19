const test = require('node:test');
const assert = require('node:assert/strict');
const { createBusinessPacing } = require('../src/utils/business-pacing');
test('business interval uses send time and bounded jitter; abort cancels pacing wait', async () => {
    let clock = 0, task, delay, cleared = false;
    const pacing = createBusinessPacing({ now: () => clock, random: () => 0.5,
        setTimer: (fn, ms) => { task = fn; delay = ms; return 1; },
        clearTimer: () => { cleared = true; } });
    await pacing.wait(); pacing.sent();
    clock = 100;
    const next = pacing.wait();
    assert.equal(delay, 275);
    clock = 375; task(); await next; pacing.sent();
    const controller = new AbortController();
    const cancelled = pacing.wait(controller.signal);
    controller.abort();
    await assert.rejects(cancelled, err => err.code === 'CONNECTION_CLOSED');
    assert.equal(cleared, true);
});
