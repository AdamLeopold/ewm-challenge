import * as SunCalc from './vendor/suncalc-2.1.1.mjs';

export const HK_LOCATION = Object.freeze({lat: 22.50, lng: 114.075});
export const WEATHER_URL = 'https://data.weather.gov.hk/weatherAPI/opendata/weather.php?dataType=rhrread&lang=en';
export const WEATHER_CACHE_KEY = 'agentic-city-hko-weather-v1';
export const MAX_WEATHER_AGE_MS = 2 * 60 * 60 * 1000;
export const WEATHER_REQUEST_TIMEOUT_MS = 8000;

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const HK_OFFSET = 8 * HOUR;
const MAX_FUTURE_MS = 5 * 60 * 1000;
const RAD = Math.PI / 180;
const condition = (key, label, cloud, rain = 0, fog = 0, storm = 0) => ({key, label, cloud, rain, fog, storm});
const NEUTRAL = condition('neutral', 'Weather unavailable', .35, 0, .05);
const PREVIEWS = Object.freeze({
  clear: condition('clear', 'Clear', .08),
  cloudy: condition('cloudy', 'Cloudy', .78),
  rain: condition('rain', 'Rain', .94, .65, .18),
  storm: condition('storm', 'Thunderstorms', 1, 1, .3, 1),
  fog: condition('fog', 'Fog', .78, 0, .85)
});

// HKO weather icons describe the territory-wide report, not individual streets.
// The rank selects a sky condition when temperature/humidity icons also occur.
const ICONS = new Map([
  [50, [20, condition('clear', 'Sunny', .06)]],
  [51, [30, condition('partly', 'Sunny periods', .25)]],
  [52, [35, condition('partly', 'Sunny intervals', .5)]],
  [53, [70, condition('showers', 'Sunny periods with a few showers', .55, .2, .06)]],
  [54, [75, condition('showers', 'Sunny intervals with showers', .72, .4, .1)]],
  [60, [40, condition('cloudy', 'Cloudy', .78)]],
  [61, [50, condition('overcast', 'Overcast', .98, 0, .1)]],
  [62, [80, condition('showers', 'Light rain', .88, .28, .12)]],
  [63, [85, PREVIEWS.rain]],
  [64, [90, condition('heavy-rain', 'Heavy rain', 1, .9, .24)]],
  [65, [100, PREVIEWS.storm]],
  ...[70, 71, 72, 73, 74, 75].map(code => [code, [20, condition('clear', 'Fine', .06)]]),
  [76, [40, condition('cloudy', 'Mainly cloudy', .78)]],
  [77, [30, condition('partly', 'Mainly fine', .2)]],
  [80, [1, condition('neutral', 'Windy', .35)]],
  [81, [1, condition('neutral', 'Dry', .35)]],
  [82, [1, condition('neutral', 'Humid', .35, 0, .1)]],
  [83, [78, PREVIEWS.fog]],
  [84, [65, condition('mist', 'Mist', .58, 0, .5)]],
  [85, [55, condition('haze', 'Haze', .36, 0, .34)]],
  [90, [1, condition('neutral', 'Hot', .35)]],
  [91, [1, condition('neutral', 'Warm', .35)]],
  [92, [1, condition('neutral', 'Cool', .35)]],
  [93, [1, condition('neutral', 'Cold', .35)]]
]);

export function normalizeWeather(icons) {
  if (!Array.isArray(icons) || !icons.length || icons.some(code => !Number.isInteger(code) || !ICONS.has(code))) {
    return {...NEUTRAL};
  }
  const selected = icons.map(code => ICONS.get(code)).reduce((best, next) => next[0] > best[0] ? next : best);
  return {...selected[1]};
}

function timestamp(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return NaN;
  return Date.parse(value);
}

export function parseWeatherReport(raw, nowMs = Date.now()) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Invalid weather report.');
  const updatedAt = timestamp(raw.updateTime);
  if (!Number.isFinite(nowMs) || !Number.isFinite(updatedAt) || updatedAt > nowMs + MAX_FUTURE_MS) {
    throw new Error('Invalid weather report time.');
  }
  if (!Array.isArray(raw.icon) || !raw.icon.length || raw.icon.some(code => !Number.isInteger(code) || !ICONS.has(code))) {
    throw new Error('Weather condition is unavailable.');
  }
  const iconTime = timestamp(raw.iconUpdateTime);
  return {updatedAt, iconUpdatedAt: Number.isFinite(iconTime) ? iconTime : null, weather: normalizeWeather(raw.icon)};
}

function isFresh(report, nowMs) {
  return !!report && Number.isFinite(report.updatedAt) && report.updatedAt <= nowMs + MAX_FUTURE_MS && nowMs - report.updatedAt <= MAX_WEATHER_AGE_MS;
}

function direction({altitude, azimuth}) {
  const altitudeRadians = altitude * RAD, azimuthRadians = azimuth * RAD;
  return [Math.cos(altitudeRadians) * Math.sin(azimuthRadians), Math.cos(altitudeRadians) * Math.cos(azimuthRadians), Math.sin(altitudeRadians)];
}

function smoothstep(low, high, value) {
  const t = Math.max(0, Math.min(1, (value - low) / (high - low)));
  return t * t * (3 - 2 * t);
}

export function computeEnvironment(nowDate, options = {}, report = null) {
  const nowMs = nowDate instanceof Date ? nowDate.valueOf() : NaN;
  if (!Number.isFinite(nowMs)) throw new Error('Invalid environment time.');
  const time = ['day', 'sunset', 'night'].includes(options.time) ? options.time : 'live';
  const weatherOverride = Object.hasOwn(PREVIEWS, options.weather) ? options.weather : 'live';
  const hkMidnight = Math.floor((nowMs + HK_OFFSET) / DAY) * DAY - HK_OFFSET;
  let date = new Date(nowMs);
  if (time === 'day') date = new Date(hkMidnight + 12 * HOUR);
  if (time === 'night') date = new Date(hkMidnight + 22 * HOUR);
  if (time === 'sunset') {
    date = SunCalc.getTimes(date, HK_LOCATION.lat, HK_LOCATION.lng, 0, 480).sunset || new Date(hkMidnight + 18 * HOUR);
  }
  const sunPosition = SunCalc.getPosition(date, HK_LOCATION.lat, HK_LOCATION.lng);
  const moonPosition = SunCalc.getMoonPosition(date, HK_LOCATION.lat, HK_LOCATION.lng);
  const illumination = SunCalc.getMoonIllumination(date);
  const weatherAvailable = isFresh(report, nowMs) && !!report.weather;
  const weather = weatherOverride !== 'live' ? PREVIEWS[weatherOverride] : weatherAvailable ? report.weather : NEUTRAL;
  return {
    date,
    preview: time !== 'live' || weatherOverride !== 'live',
    sun: {...sunPosition, direction: direction(sunPosition)},
    moon: {...moonPosition, ...illumination, direction: direction(moonPosition)},
    daylight: smoothstep(-6, 8, sunPosition.altitude),
    twilight: 1 - smoothstep(0, 12, Math.abs(sunPosition.altitude)),
    weather: {...weather},
    weatherAvailable
  };
}

export function createWeatherClient(options = {}) {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const now = options.now ?? Date.now;
  const onChange = options.onChange ?? (() => {});
  // Accessing localStorage itself can throw, e.g. when storage is blocked.
  let storage;
  try { storage = Object.hasOwn(options, 'storage') ? options.storage : globalThis.localStorage; } catch { storage = null; }
  let report = null, phase = 'unavailable', error;
  let pending = null, controller = null, timer = null, cancelRequest = null, disposed = false;

  try {
    const cached = JSON.parse(storage?.getItem(WEATHER_CACHE_KEY) || 'null');
    if (cached?.version === 1) {
      const parsed = parseWeatherReport(cached.raw, now());
      if (isFresh(parsed, now())) { report = parsed; phase = 'cached'; }
    }
  } catch { /* A missing or invalid cache must not affect the city. */ }

  function getSnapshot() {
    const fresh = isFresh(report, now());
    const status = phase === 'loading' ? 'loading' : fresh ? phase : 'unavailable';
    return {
      report: fresh ? {...report, weather: {...report.weather}} : null,
      status,
      ...(error ? {error} : !fresh && report ? {error: 'Weather report is out of date.'} : {})
    };
  }

  function notify() {
    if (!disposed) {
      try { onChange(getSnapshot()); } catch { /* Consumer UI failures do not invalidate a report. */ }
    }
  }

  function refresh() {
    if (disposed) return Promise.resolve(getSnapshot());
    if (pending) return pending;
    phase = 'loading'; error = undefined; notify();
    controller = new AbortController();
    const signal = controller.signal;
    pending = (async () => {
      try {
        const deadline = new Promise((_, reject) => {
          cancelRequest = reject;
          timer = setTimeout(() => {
            controller?.abort();
            reject(new Error('Weather request timed out after 8 seconds.'));
          }, WEATHER_REQUEST_TIMEOUT_MS);
        });
        const request = (async () => {
          if (typeof fetchImpl !== 'function') throw new Error('Weather service is unavailable.');
          const response = await fetchImpl(WEATHER_URL, {signal, cache: 'no-store', credentials: 'omit'});
          if (!response?.ok) throw new Error('Weather service is unavailable.');
          const raw = await response.json();
          const parsed = parseWeatherReport(raw, now());
          if (!isFresh(parsed, now())) throw new Error('Weather report is out of date.');
          return {raw, parsed};
        })();
        const result = await Promise.race([request, deadline]);
        if (!disposed) {
          report = result.parsed; phase = 'live';
          try {
            storage?.setItem(WEATHER_CACHE_KEY, JSON.stringify({version: 1, raw: {
              updateTime: result.raw.updateTime, iconUpdateTime: result.raw.iconUpdateTime, icon: result.raw.icon
            }}));
          } catch { /* Private browsing and quota failures still allow live weather. */ }
        }
      } catch (cause) {
        if (!disposed) {
          error = cause instanceof Error ? cause.message : 'Weather service is unavailable.';
          phase = isFresh(report, now()) ? 'cached' : 'unavailable';
        }
      } finally {
        clearTimeout(timer); timer = null; cancelRequest = null; controller = null; pending = null;
        notify();
      }
      return getSnapshot();
    })();
    return pending;
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    phase = isFresh(report, now()) ? 'cached' : 'unavailable';
    controller?.abort();
    cancelRequest?.(new Error('Weather client disposed.'));
    clearTimeout(timer);
  }

  return {getSnapshot, refresh, dispose};
}
