const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.join(__dirname, '..');
const opening = Date.parse('2026-11-18T00:00:00Z');
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

test('both platforms count to 18 November, including the final second', () => {
  for (const world of worlds) {
    const run = setup(opening - 1000, 'en', world);
    assert.equal(run.config[world].countdown.date, '2026-11-18T00:00:00Z');
    assert.match(run.countdown.innerHTML, /Until Track opening/);
    assert.match(run.countdown.innerHTML, /<b>01<\/b><i>SEC/);
    assert.match(run.countdown.innerHTML, /18 Nov, 08:00 HKT\/SGT · 00:00 UTC/);
    assert.equal(run.intervals.size, 1);
    run.advance(opening);
    assert.match(run.countdown.innerHTML, /Track open/);
    assert.doesNotMatch(run.countdown.innerHTML, /Until|DAYS|HRS|MIN|SEC/);
    assert.equal(run.intervals.size, 0);
  }
});

test('after opening neither platform moves its countdown to a later milestone', () => {
  for (const world of worlds) {
    for (const now of [opening, opening + 86400000, Date.parse('2026-11-20T00:00:00Z')]) {
      const run = setup(now, 'en', world);
      run.config[world].timeline.push({ date: '2026-11-25T00:00:00Z', zh: '后续节点', en: 'Later milestone' });
      run.refresh();
      assert.equal(run.countdown.hidden, false);
      assert.match(run.countdown.innerHTML, /Track open/);
      assert.doesNotMatch(run.countdown.innerHTML, /Later milestone/);
      assert.equal(run.intervals.size, 0);
    }
  }
});

test('language changes preserve the target and one timer for each platform', () => {
  for (const world of worlds) {
    const run = setup(opening - 86400000, 'zh', world);
    run.refresh(); run.refresh();
    assert.equal(run.intervals.size, 1);
    assert.match(run.countdown.innerHTML, /赛道开启/);
    assert.match(run.countdown.innerHTML, /11\/18 08:00 HKT\/SGT/);
    assert.match(run.countdown.innerHTML, /<b>01<\/b><i>天/);
    run.setLanguage('en');
    assert.equal(run.intervals.size, 1);
    assert.match(run.countdown.innerHTML, /Until Track opening/);
    assert.match(run.countdown.innerHTML, /<b>01<\/b><i>DAYS/);
    run.advance(opening);
    run.setLanguage('zh');
    assert.match(run.countdown.innerHTML, /赛道已开启/);
    assert.equal(run.intervals.size, 0);
    assert.equal(run.config[world].countdown.date, '2026-11-18T00:00:00Z');
  }
});

test('countdown output is identical across visitor time zones', () => {
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
