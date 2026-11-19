import {createEnvironment} from './environment.js?v=environment-2';
import {computeEnvironment, createWeatherClient} from './environment-state.mjs?v=environment-2';

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

const PANEL = `<summary id="environment-toggle" aria-label="Environment settings" aria-controls="environment-options" aria-expanded="false" title="Environment settings"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9.5 3-.5 2-1.8 1-2-.6-2.5 4.2 1.5 1.4v2L2.7 14.4l2.5 4.2 2-.6L9 19l.5 2h5l.5-2 1.8-1 2 .6 2.5-4.2-1.5-1.4v-2l1.5-1.4-2.5-4.2-2 .6L15 5l-.5-2z"/><circle cx="12" cy="12" r="3"/></svg></summary>
<div class="environment-body" id="environment-options">
<div class="environment-heading">Environment <span id="environment-mode">Live</span></div>
<p id="environment-summary">Hong Kong · Connecting weather…</p>
<dl><dt>Hong Kong now</dt><dd id="environment-clock">—</dd><dt>Scene time</dt><dd id="environment-scene-time">—</dd></dl>
<label for="environment-time">Time of day<select id="environment-time"><option value="live">Live · Hong Kong time</option><option value="day">Day · 12:00</option><option value="sunset">Sunset · today</option><option value="night">Night · 22:00</option></select></label>
<label for="environment-weather">Weather<select id="environment-weather"><option value="live">Live · official report</option><option value="clear">Clear</option><option value="cloudy">Cloudy</option><option value="rain">Rain</option><option value="storm">Thunderstorm</option><option value="fog">Fog</option></select></label>
<div class="environment-actions"><button type="button" id="environment-reset" disabled>Return to live</button><button type="button" id="environment-refresh">Refresh weather</button></div>
<p id="environment-data" role="status">Fetching the latest official weather…</p>
<p>Weather: <a href="https://www.hko.gov.hk/en/wxinfo/currwx/current.htm" target="_blank" rel="noopener">Hong Kong Observatory ↗</a>. Hong Kong overview · updated every 10 minutes.</p>
<p>Explore daylight and weather previews. The moon follows its position and phase; night lighting keeps the city readable.</p>
</div>`;

/** Keep weather requests and controls independent of city geometry/loading.
 *  The city renders on demand, so this module asks for frames only while the sky changes or rain falls. */
export function startEnvironment({scene, camera, renderer, controls, sunLight, hemisphere, rendering}) {
  const panel = document.createElement('details');
  panel.id = 'environment'; panel.dataset.preview = 'false'; panel.innerHTML = PANEL;
  document.body.append(panel);
  const toggle = document.getElementById('environment-toggle');
  const timeSelect = document.getElementById('environment-time');
  const weatherSelect = document.getElementById('environment-weather');
  const reset = document.getElementById('environment-reset');
  const refresh = document.getElementById('environment-refresh');
  const mediaQuery = matchMedia('(prefers-reduced-motion: reduce)');
  // The city's shadow fit listens to camera changes; a change event refits it to the new sun.
  const refitSun = () => controls.dispatchEvent({type: 'change'});
  const atmosphere = createEnvironment({scene, camera, renderer, controls, sunLight, hemisphere, refitSun, reducedMotion: mediaQuery.matches});
  const overrides = {time: 'live', weather: 'live'};
  let client, state, disposed = false, lastCompute = 0, lastRefresh = 0, first = true, frame = 0, lastFrame = 0;

  function tick(now) {
    frame = 0;
    if (disposed || document.hidden) return;
    const dt = lastFrame ? (now - lastFrame) / 1000 : 0;
    lastFrame = now;
    const animating = atmosphere.update(dt);
    rendering.invalidate();
    if (animating) frame = requestAnimationFrame(tick);
    else lastFrame = 0;
  }
  function wake() {
    if (!frame && !disposed && !document.hidden) frame = requestAnimationFrame(tick);
  }

  function paintStatus(now, snapshot) {
    const clock = clockFormat.format(now);
    setText(document.getElementById('environment-summary'), `HK ${clock} · ${state.weather.label}`);
    setText(document.getElementById('environment-mode'), state.preview ? 'Preview' : 'Live');
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
      if (first) rendering.invalidate(true);
      first = false;
      lastCompute = now.getTime();
      wake();
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
    wake();
    if (Date.now() - lastRefresh >= REFRESH_MS) void refreshWeather();
  }
  function motionChanged(event) { atmosphere.setReducedMotion(event.matches); wake(); }
  function pageHidden(event) { if (!event.persisted) dispose(); }
  function panelToggled() { toggle.setAttribute('aria-expanded', String(panel.open)); }
  function outsidePointer(event) {
    if (panel.open && !panel.contains(event.target)) panel.open = false;
  }
  function panelKeydown(event) {
    if (event.key !== 'Escape' || !panel.open) return;
    event.preventDefault();
    event.stopPropagation();
    panel.open = false;
    toggle.focus();
  }

  panel.addEventListener('toggle', panelToggled);
  document.addEventListener('pointerdown', outsidePointer);
  document.addEventListener('keydown', panelKeydown);
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
    if (frame) cancelAnimationFrame(frame);
    client.dispose();
    atmosphere.dispose();
    panel.removeEventListener('toggle', panelToggled);
    document.removeEventListener('pointerdown', outsidePointer);
    document.removeEventListener('keydown', panelKeydown);
    timeSelect.removeEventListener('change', changePreview);
    weatherSelect.removeEventListener('change', changePreview);
    reset.removeEventListener('click', resetPreview);
    refresh.removeEventListener('click', requestRefresh);
    document.removeEventListener('visibilitychange', visibilityChanged);
    mediaQuery.removeEventListener('change', motionChanged);
    removeEventListener('pagehide', pageHidden);
  }

  const controller = {
    refreshWeather,
    dispose,
    getState() { return state; },
    getDiagnostics() {
      const snapshot = client.getSnapshot();
      return {...atmosphere.getDiagnostics(), weatherStatus: snapshot.status, weatherError: snapshot.error || null,
        weatherUpdatedAt: snapshot.report?.updatedAt || null, preview: state.preview, animating: Boolean(frame)};
    }
  };
  window.cityEnvironment = controller;
  return controller;
}
