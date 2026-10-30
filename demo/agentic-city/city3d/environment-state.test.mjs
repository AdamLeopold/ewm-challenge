import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {
  normalizeWeather, parseWeatherReport, computeEnvironment, createWeatherClient,
  MAX_WEATHER_AGE_MS, WEATHER_CACHE_KEY, WEATHER_URL
} from './environment-state.mjs';

const nowMs = Date.parse('2026-10-30T14:02:00+08:00');
const raw = (icons = [51], updatedAt = nowMs) => ({
  icon: icons, updateTime: new Date(updatedAt).toISOString(), iconUpdateTime: '2026-10-30T07:00:00+08:00'
});
const memoryStorage = () => {
  const values = new Map();
  return {getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value)};
};
const success = body => ({ok: true, json: async () => body});

test('official sky, precipitation and night icons are mapped without using lunar icons as a clock', () => {
  const expected = new Map([[50, 'clear'], [51, 'partly'], [52, 'partly'], [53, 'showers'], [54, 'showers'], [60, 'cloudy'], [61, 'overcast'], [62, 'showers'], [63, 'rain'], [64, 'heavy-rain'], [65, 'storm'], [76, 'cloudy'], [77, 'partly'], [83, 'fog'], [84, 'mist'], [85, 'haze']]);
  for (let code = 70; code <= 75; code++) expected.set(code, 'clear');
  for (const [icon, key] of expected) {
    const weather = normalizeWeather([icon]);
    assert.equal(weather.key, key, `icon ${icon}`);
    for (const value of ['cloud', 'rain', 'fog', 'storm']) assert.ok(weather[value] >= 0 && weather[value] <= 1);
  }
  assert.equal(normalizeWeather([90, 51, 65]).key, 'storm');
  assert.equal(normalizeWeather([80]).label, 'Windy');
  assert.equal(normalizeWeather([81]).rain, 0);
  assert.equal(normalizeWeather([82]).key, 'neutral');
});

test('reports require explicit valid times and known icons; unchanged icon time is not stale data', () => {
  const parsed = parseWeatherReport(raw(), nowMs);
  assert.equal(parsed.updatedAt, nowMs);
  assert.equal(computeEnvironment(new Date(nowMs), {}, parsed).weatherAvailable, true);
  for (const bad of [null, {}, {icon: [51]}, {...raw(), updateTime: '2026-10-30T14:02:00'}, raw([]), raw([999]), raw(['51']), raw([51, 999]), raw([50], nowMs + 301000)]) {
    assert.throws(() => parseWeatherReport(bad, nowMs));
  }
  assert.equal(normalizeWeather([999]).key, 'neutral');
  assert.equal(parseWeatherReport({...raw(), iconUpdateTime: 'invalid'}, nowMs).iconUpdatedAt, null);
});

test('Hong Kong previews keep the Hong Kong calendar day across UTC midnight and visitor time zones', () => {
  const instant = new Date('2026-10-30T17:00:00Z'); // Oct 31 in Hong Kong.
  assert.equal(computeEnvironment(instant, {time: 'day'}).date.toISOString(), '2026-10-31T04:00:00.000Z');
  assert.equal(computeEnvironment(instant, {time: 'night'}).date.toISOString(), '2026-10-31T14:00:00.000Z');
  assert.equal(computeEnvironment(instant, {}).date.valueOf(), instant.valueOf());
  const moduleURL = new URL('./environment-state.mjs', import.meta.url).href;
  const program = `import {computeEnvironment} from ${JSON.stringify(moduleURL)}; console.log(JSON.stringify(['day','sunset','night'].map(time=>computeEnvironment(new Date('2026-10-30T17:00:00Z'),{time}).date.toISOString())));`;
  const results = ['UTC', 'America/Los_Angeles', 'Asia/Tokyo'].map(TZ => execFileSync(process.execPath, ['--input-type=module', '-e', program], {env: {...process.env, TZ}, encoding: 'utf8'}).trim());
  assert.equal(new Set(results).size, 1);
});

test('astronomy uses Z-up unit directions and continuous daylight; real moon phase and horizon are preserved', () => {
  const day = computeEnvironment(new Date(nowMs), {time: 'day', weather: 'clear'});
  const night = computeEnvironment(new Date(nowMs), {time: 'night', weather: 'rain'});
  const sunset = computeEnvironment(new Date(nowMs), {time: 'sunset'});
  assert.equal(day.daylight, 1);
  assert.equal(night.daylight, 0);
  assert.ok(day.sun.direction[2] > 0 && night.sun.direction[2] < 0);
  assert.ok(sunset.twilight > .95 && sunset.daylight > 0 && sunset.daylight < 1);
  assert.ok(sunset.sun.direction[0] < 0, 'setting sun is west of the district');
  for (const state of [day, night, sunset]) {
    for (const body of [state.sun, state.moon]) assert.ok(Math.abs(Math.hypot(...body.direction) - 1) < 1e-10);
  }
  assert.ok(day.moon.altitude < 0 && night.moon.altitude > 0);
  const newMoon = computeEnvironment(new Date('2026-10-10T12:00:00Z'));
  const fullMoon = computeEnvironment(new Date('2026-10-26T12:00:00Z'));
  assert.ok(newMoon.moon.fraction < .02 && fullMoon.moon.fraction > .98);
  assert.notEqual(newMoon.moon.phase, fullMoon.moon.phase);
  assert.equal(day.preview, true);
  assert.equal(night.weather.key, 'rain');
  assert.equal(computeEnvironment(new Date(nowMs), {}, parseWeatherReport(raw(), nowMs)).preview, false);
});

test('weather freshness uses the report age, not preview time; expired weather falls back to neutral', () => {
  const report = parseWeatherReport(raw(), nowMs);
  assert.equal(computeEnvironment(new Date(nowMs), {time: 'night'}, report).weatherAvailable, true);
  const expired = computeEnvironment(new Date(nowMs + MAX_WEATHER_AGE_MS + 1), {}, report);
  assert.equal(expired.weatherAvailable, false);
  assert.equal(expired.weather.key, 'neutral');
  assert.equal(expired.preview, false);
  assert.equal(computeEnvironment(new Date(nowMs + MAX_WEATHER_AGE_MS + 1), {weather: 'fog'}, report).weather.key, 'fog');
});

test('client deduplicates refresh, reports loading/live, and persists only relevant HKO data', async () => {
  const storage = memoryStorage(), seen = [];
  let calls = 0, complete;
  const client = createWeatherClient({storage, now: () => nowMs, onChange: state => seen.push(state.status), fetchImpl: (url, options) => {
    calls++;
    assert.equal(url, WEATHER_URL);
    assert.equal(options.credentials, 'omit');
    return new Promise(resolve => { complete = resolve; });
  }});
  const first = client.refresh(), second = client.refresh();
  assert.equal(first, second);
  assert.equal(calls, 1);
  assert.equal(client.getSnapshot().status, 'loading');
  complete(success({...raw(), privateExtra: 'not cached'}));
  const result = await first;
  assert.equal(result.status, 'live');
  assert.deepEqual(seen, ['loading', 'live']);
  assert.equal(storage.getItem(WEATHER_CACHE_KEY).includes('privateExtra'), false);
  result.report.weather.key = 'mutated';
  assert.equal(client.getSnapshot().report.weather.key, 'partly');
  client.dispose();
});

test('network failures use valid cache and become unavailable when that cache expires', async () => {
  const storage = memoryStorage();
  storage.setItem(WEATHER_CACHE_KEY, JSON.stringify({version: 1, raw: raw([63])}));
  let clock = nowMs;
  const client = createWeatherClient({storage, now: () => clock, fetchImpl: async () => { throw new TypeError('Network offline'); }});
  assert.equal(client.getSnapshot().status, 'cached');
  assert.equal((await client.refresh()).status, 'cached');
  assert.equal(client.getSnapshot().report.weather.key, 'rain');
  clock += MAX_WEATHER_AGE_MS + 1;
  assert.equal(client.getSnapshot().status, 'unavailable');
  assert.equal(client.getSnapshot().report, null);
  assert.equal((await client.refresh()).status, 'unavailable');
  client.dispose();
});

test('malformed reports, missing icons, unknown icons and stale responses cannot replace current cached conditions', async () => {
  for (const body of [{}, raw([]), raw([500]), raw([63], nowMs - MAX_WEATHER_AGE_MS - 1), {...raw(), updateTime: 'invalid'}]) {
    const storage = memoryStorage();
    storage.setItem(WEATHER_CACHE_KEY, JSON.stringify({version: 1, raw: raw([50])}));
    const client = createWeatherClient({storage, now: () => nowMs, fetchImpl: async () => success(body)});
    const result = await client.refresh();
    assert.equal(result.status, 'cached');
    assert.equal(result.report.weather.key, 'clear');
    client.dispose();
  }
});

test('blocked storage and invalid cached JSON do not stop live weather', async () => {
  for (const storage of [{getItem() { throw new Error('Storage blocked'); }, setItem() { throw new Error('Storage blocked'); }}, {getItem: () => '{bad JSON', setItem() {}}]) {
    const client = createWeatherClient({storage, now: () => nowMs, fetchImpl: async () => success(raw())});
    assert.equal((await client.refresh()).status, 'live');
    client.dispose();
  }
});

test('client timeout also works when a fetch implementation ignores its AbortSignal', {timeout: 10000}, async () => {
  const client = createWeatherClient({storage: null, now: () => nowMs, fetchImpl: () => new Promise(() => {})});
  const result = await client.refresh();
  assert.equal(result.status, 'unavailable');
  assert.match(result.error, /timed out/);
  client.dispose();
});

test('dispose aborts a pending request without late updates or stuck refresh promises', async () => {
  const seen = [];
  let signal;
  const client = createWeatherClient({storage: null, now: () => nowMs, onChange: state => seen.push(state.status), fetchImpl: (_url, options) => {
    signal = options.signal;
    return new Promise(() => {});
  }});
  const pending = client.refresh();
  client.dispose();
  assert.equal(signal.aborted, true);
  assert.equal((await pending).status, 'unavailable');
  assert.deepEqual(seen, ['loading']);
  assert.equal((await client.refresh()).status, 'unavailable');
});
