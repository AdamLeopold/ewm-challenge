import {createEnvironment} from './environment.js?v=environment-1';
import {computeEnvironment, createWeatherClient} from './environment-state.mjs?v=environment-1';

const REFRESH_MS = 10 * 60 * 1000;
const clockFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Hong_Kong', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
});
const dateFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Hong_Kong', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
});
function setText(element, value) {
  if (element.textContent !== value) element.textContent = value;
}

/** Keep weather requests and controls independent of city geometry/loading. */
export function startEnvironment(options) {
  const panel = document.getElementById('environment');
  const timeSelect = document.getElementById('environment-time');
  const weatherSelect = document.getElementById('environment-weather');
  const reset = document.getElementById('environment-reset');
  const refresh = document.getElementById('environment-refresh');
  const mediaQuery = matchMedia('(prefers-reduced-motion: reduce)');
  const atmosphere = createEnvironment({...options, reducedMotion: mediaQuery.matches});
  const overrides = {time: 'live', weather: 'live'};
  let client, state, disposed = false, lastCompute = 0, lastRefresh = 0, first = true;

  function paintStatus(now, snapshot) {
    const clock = clockFormat.format(now);
    const summary = document.getElementById('environment-summary');
    const badge = document.getElementById('environment-mode');
    setText(summary, `HK ${clock} · ${state.weather.label}`);
    setText(badge, state.preview ? 'Preview' : 'Live');
    panel.dataset.preview = String(state.preview);
    setText(document.getElementById('environment-clock'), `${dateFormat.format(now)} HKT`);
    setText(document.getElementById('environment-scene-time'), `${clockFormat.format(overrides.time === 'live' ? now : state.date)} HKT${overrides.time === 'live' ? ' · follows the clock' : ' · time preview'}`);
    const reportTime = snapshot.report ? dateFormat.format(new Date(snapshot.report.updatedAt)) : null;
    const dataStatus = document.getElementById('environment-data');
    if (snapshot.status === 'live') setText(dataStatus, `Official report: ${reportTime} HKT`);
    else if (snapshot.status === 'cached') setText(dataStatus, `Cached report: ${reportTime} HKT · retrying on the next update`);
    else if (snapshot.status === 'loading') setText(dataStatus, 'Fetching the latest official weather…');
    else setText(dataStatus, state.preview ? 'Real-time weather unavailable · preview remains available' : 'Weather unavailable · following Hong Kong time');
    reset.disabled = !state.preview;
    refresh.disabled = snapshot.status === 'loading';
  }

  function synchronize(force = false) {
    if (disposed || !client) return;
    const now = new Date();
    const snapshot = client.getSnapshot();
    if (force || now.getTime() - lastCompute >= 30000) {
      state = computeEnvironment(now, overrides, snapshot.report);
      atmosphere.setState(state, {immediate: first});
      first = false;
      lastCompute = now.getTime();
    }
    paintStatus(now, snapshot);
  }

  async function refreshWeather() {
    if (disposed) return;
    lastRefresh = Date.now();
    await client.refresh();
    synchronize(true);
  }

  client = createWeatherClient({onChange: () => synchronize(true)});
  synchronize(true);
  void refreshWeather();

  function changePreview() {
    overrides.time = timeSelect.value;
    overrides.weather = weatherSelect.value;
    synchronize(true);
  }
  function resetPreview() {
    timeSelect.value = weatherSelect.value = 'live';
    changePreview();
  }
  function requestRefresh() { void refreshWeather(); }
  function visibilityChanged() {
    if (document.hidden) return;
    synchronize(true);
    if (Date.now() - lastRefresh >= REFRESH_MS) void refreshWeather();
  }
  function motionChanged(event) { atmosphere.setReducedMotion(event.matches); }
  function pageHidden(event) { if (!event.persisted) dispose(); }

  timeSelect.addEventListener('change', changePreview);
  weatherSelect.addEventListener('change', changePreview);
  reset.addEventListener('click', resetPreview);
  refresh.addEventListener('click', requestRefresh);
  document.addEventListener('visibilitychange', visibilityChanged);
  mediaQuery.addEventListener('change', motionChanged);
  addEventListener('pagehide', pageHidden);
  const timer = setInterval(() => {
    if (document.hidden || disposed) return;
    synchronize();
    if (Date.now() - lastRefresh >= REFRESH_MS) void refreshWeather();
  }, 1000);

  function dispose() {
    if (disposed) return;
    disposed = true;
    clearInterval(timer);
    client.dispose();
    atmosphere.dispose();
    timeSelect.removeEventListener('change', changePreview);
    weatherSelect.removeEventListener('change', changePreview);
    reset.removeEventListener('click', resetPreview);
    refresh.removeEventListener('click', requestRefresh);
    document.removeEventListener('visibilitychange', visibilityChanged);
    mediaQuery.removeEventListener('change', motionChanged);
    removeEventListener('pagehide', pageHidden);
  }

  const controller = {
    update(dt) { if (!disposed && !document.hidden) atmosphere.update(dt); },
    refreshWeather,
    dispose,
    getState() { return state; },
    getDiagnostics() {
      const snapshot = client.getSnapshot();
      return {...atmosphere.getDiagnostics(), weatherStatus: snapshot.status, weatherError: snapshot.error || null,
        weatherUpdatedAt: snapshot.report?.updatedAt || null, preview: state.preview};
    }
  };
  window.cityEnvironment = controller;
  return controller;
}
