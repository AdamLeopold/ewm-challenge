const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.join(__dirname, '..');
const opening = Date.parse('2026-12-01T00:00:00Z');   // any moment: the opening is published as a month, not a time
const worlds = ['holobit', 'city'];

function setup(now, lang = 'en', world = 'holobit') {
  let clock = now, language = lang, sequence = 0;
  const intervals = new Map();
  const countdown = { dataset: { countdown: world }, innerHTML: '', hidden: false };
  class ClockDate extends Date { static now() { return clock; } }
  const context = { Date: ClockDate, setTimeout: fn => fn(),
    setInterval: fn => { intervals.set(++sequence, fn); return sequence; },
    clearInterval: id => intervals.delete(id),
    document: { querySelectorAll: selector => selector === '[data-countdown]' ? [countdown] : [], addEventListener() {} },
    window: { SW_t: (zh, en) => language === 'en' ? en : zh }
  };
  vm.createContext(context);
  for (const file of ['config.js', 'pages.js']) vm.runInContext(fs.readFileSync(path.join(root, 'assets/js', file), 'utf8'), context);
  context.window.SW_refresh();
  return { countdown, intervals, config: context.window.SW_CONFIG,
    advance: time => { clock = time; [...intervals.values()].forEach(fn => fn()); },
    refresh: () => context.window.SW_refresh(),
    setLanguage: value => { language = value; context.window.SW_refresh(); } };
}

test('both platforms show the opening month and run no clock', () => {
  for (const world of worlds) {
    for (const now of [opening - 86400000, opening, opening + 20 * 86400000]) {
      const run = setup(now, 'en', world);
      assert.equal(run.config[world].countdown.date, undefined);
      assert.equal(run.countdown.hidden, false);
      assert.match(run.countdown.innerHTML, /Track opening/);
      assert.match(run.countdown.innerHTML, /December 2026/);
      assert.doesNotMatch(run.countdown.innerHTML, /Until|DAYS|HRS|MIN|SEC|18 Nov/);
      assert.equal(run.intervals.size, 0);
    }
  }
});

test('the timeline prints the month, not a day', () => {
  for (const world of worlds) {
    const run = setup(opening - 86400000, 'en', world);
    const first = run.config[world].timeline[0];
    assert.deepEqual({ ...first.label }, { zh: '2026 年 12 月', en: 'Dec 2026' });
    assert.match(first.den, /December 2026/);
    assert.doesNotMatch(first.den + first.dzh, /18 November|11 月 18 日/);
  }
});

test('language changes switch the label and still start no clock', () => {
  for (const world of worlds) {
    const run = setup(opening - 86400000, 'zh', world);
    run.refresh(); run.refresh();
    assert.equal(run.intervals.size, 0);
    assert.match(run.countdown.innerHTML, /赛道开启/);
    assert.match(run.countdown.innerHTML, /2026 年 12 月/);
    run.setLanguage('en');
    assert.equal(run.intervals.size, 0);
    assert.match(run.countdown.innerHTML, /Track opening/);
    assert.match(run.countdown.innerHTML, /December 2026/);
  }
});

test('output is identical across visitor time zones', () => {
  const original = process.env.TZ;
  try {
    for (const world of worlds) {
      const results = ['Asia/Hong_Kong', 'America/Los_Angeles', 'Europe/London', 'Pacific/Auckland'].map(zone => {
        process.env.TZ = zone;
        return setup(opening - 90061000, 'en', world).countdown.innerHTML;
      });
      assert.ok(results.every(result => result === results[0]));
    }
  } finally { if (original === undefined) delete process.env.TZ; else process.env.TZ = original; }
});
