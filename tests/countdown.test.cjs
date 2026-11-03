const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.join(__dirname, '..');
const freeze = Date.parse('2026-11-07T00:00:00Z');

function setup(now, lang = 'en') {
  let clock = now, sequence = 0;
  const intervals = new Map();
  const countdown = { dataset: { countdown: 'holobit' }, innerHTML: '', hidden: false };
  class ClockDate extends Date { static now() { return clock; } }
  const context = { Date: ClockDate, setTimeout: fn => fn(),
    setInterval: fn => { intervals.set(++sequence, fn); return sequence; },
    clearInterval: id => intervals.delete(id),
    document: { querySelectorAll: selector => selector === '[data-countdown]' ? [countdown] : [], addEventListener() {} },
    window: { SW_t: (zh, en) => lang === 'en' ? en : zh }
  };
  vm.createContext(context);
  for (const file of ['config.js', 'pages.js']) vm.runInContext(fs.readFileSync(path.join(root, 'assets/js', file), 'utf8'), context);
  context.window.SW_refresh();
  return { countdown, intervals, config: context.window.SW_CONFIG,
    advance: time => { clock = time; [...intervals.values()].forEach(fn => fn()); },
    refresh: () => context.window.SW_refresh() };
}

test('counts to the fixed warm-up freeze, including the final second', () => {
  const run = setup(freeze - 1000);
  assert.match(run.countdown.innerHTML, /Warm-up submission freeze/);
  assert.match(run.countdown.innerHTML, /<b>01<\/b><i>SEC/);
  assert.match(run.countdown.innerHTML, /08:00 HKT\/SGT/);
  assert.equal(run.intervals.size, 1);
  run.advance(freeze);
  assert.match(run.countdown.innerHTML, /Warm-up submissions frozen/);
  assert.equal(run.intervals.size, 0);
});

test('at and after the target it stays frozen instead of moving to a later round', () => {
  for (const now of [freeze, freeze + 86400000, Date.parse('2026-11-20T00:00:00Z')]) {
    const run = setup(now);
    assert.equal(run.countdown.hidden, false);
    assert.match(run.countdown.innerHTML, /Warm-up submissions frozen/);
    assert.equal(run.intervals.size, 0);
  }
});

test('language refresh clears the old timer and preserves one fixed target', () => {
  const run = setup(freeze - 86400000, 'zh');
  run.refresh(); run.refresh();
  assert.equal(run.intervals.size, 1);
  assert.match(run.countdown.innerHTML, /热身轮提交冻结/);
  assert.equal(run.config.holobit.countdown.date, '2026-11-07T00:00:00Z');
  assert.match(run.countdown.innerHTML, /<b>01<\/b><i>天/);
});

test('countdown output is identical across visitor time zones', () => {
  const original = process.env.TZ;
  try {
    const results = ['Asia/Hong_Kong', 'America/Los_Angeles', 'Europe/London', 'Pacific/Auckland'].map(zone => {
      process.env.TZ = zone;
      return setup(freeze - 90061000).countdown.innerHTML;
    });
    assert.ok(results.every(result => result === results[0]));
  } finally { if (original === undefined) delete process.env.TZ; else process.env.TZ = original; }
});
