// Agentic City online demo: answers the studio's data and planning requests from prepared files,
// so the guided tasks run in the browser without a local server.
(() => {
  const BASE = '/demo/agentic-city/';
  const ROOT_PATH = /^\/(?:(?:three|native|v6|v5|studio|api|aligned_data|road-tiles|road-prebuilt)\/|[\w.\-]+\.(?:js|mjs|json|gz|bin|css|png|jpe?g|webp|svg|html)$)/;
  const UNAVAILABLE = 'This action needs the full local version of Agentic City. The online demo covers the three guided tasks.';
  const VOLATILE = new Set(['name', 'client', 'sequence', 'request_id', 'revision']);
  const browserFetch = window.fetch.bind(window);
  // Static hosting occasionally answers a burst of requests with 5xx; retry those with a short backoff.
  async function nativeFetch(input, init) {
    for (let attempt = 0; ; attempt++) {
      try {
        const r = await browserFetch(input, init);
        if (r.status < 500 || attempt >= 4) return r;
      } catch (e) {
        if (attempt >= 4 || e.name === 'AbortError') throw e;
      }
      await new Promise(done => setTimeout(done, 400 * 2 ** attempt));
    }
  }
  let manifestPromise = null;
  const manifest = () => manifestPromise ??= nativeFetch(BASE + 'replay/manifest.json').then(r => r.json());

  const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });
  const unavailable = ep => { console.info('Agentic City demo: no prepared answer for', ep); return json({ error: UNAVAILABLE }, 400); };
  async function gunzip(url) {
    const r = await nativeFetch(url);
    if (!r.ok) return null;
    return new Response(r.body.pipeThrough(new DecompressionStream('gzip'))).text();
  }
  async function answer(id, name) {
    const text = await gunzip(BASE + 'replay/api/' + id + '.json.gz');
    return text === null ? null : JSON.parse(text.split('__DRAFT__').join(name));
  }
  // Same canonical form as the build step: sorted keys, volatile fields removed at the top level.
  function canonical(v) {
    if (Array.isArray(v)) return '[' + v.map(canonical).join(',') + ']';
    if (v && typeof v === 'object') return '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + canonical(v[k])).join(',') + '}';
    return JSON.stringify(v);
  }
  const key = (ep, data) => ep + ' ' + canonical(data && typeof data === 'object' && !Array.isArray(data)
    ? Object.fromEntries(Object.entries(data).filter(([k]) => !VOLATILE.has(k))) : data);
  const state = name => 'agentic-city-demo:' + name;

  async function api(ep, url, data) {
    const m = await manifest();
    const name = (data && data.name) || url.searchParams.get('name') || '';
    if (ep === 'draft') {
      const id = m.drafts[sessionStorage.getItem(state(name)) || m.baseline];
      return json(await answer(id, name));
    }
    if (ep === 'studio-discard') { sessionStorage.removeItem(state(name)); return json({ discarded: name }); }
    if (ep === 'planning-summary') {
      const id = ['R', data.task ?? '', data.version, data.revision].join('|');
      return json({ request_id: id, revision: data.revision, status: 'queued', task: data.task, version: data.version });
    }
    if (ep === 'planning-poll') {
      const [, task, version, revision] = data.request_id.split('|');
      const id = m.polls[task + '|' + version];
      if (!id) return json({ request_id: data.request_id, status: 'failed', error: UNAVAILABLE });
      const r = await answer(id, name);
      return json({ ...r, request_id: data.request_id, revision: Number(revision), task: task || null, version });
    }
    if (ep === 'planning-cancel') return json({ cancelled: true });
    let query = null;
    if (!data) {
      const q = [...url.searchParams].filter(([k]) => !['name', 'cv', 'v', 'modelRevision'].includes(k));
      if (q.length) query = Object.fromEntries(q);
    }
    const id = m.api[key(ep, data ?? query)];
    if (!id) return unavailable(ep);
    const value = await answer(id, name);
    if (ep === 'studio-apply' && value && value.version) sessionStorage.setItem(state(name), value.version);
    return json(value);
  }

  window.fetch = async function (input, init = {}) {
    const request = input instanceof Request ? input : null;
    const url = new URL(request ? request.url : String(input), location.href);
    if (url.origin !== location.origin) return browserFetch(input, init);
    let path = url.pathname;
    if (!path.startsWith(BASE)) {
      if (!ROOT_PATH.test(path)) return browserFetch(input, init);
      path = BASE + path.slice(1);
    }
    const rel = '/' + path.slice(BASE.length);
    if (rel.startsWith('/api/')) {
      let text = init.body ?? null;
      if (text === null && request && request.method !== 'GET') text = await request.clone().text();
      return api(rel.slice(5), url, text ? JSON.parse(text) : null);
    }
    const m = await manifest();
    if (m.gz[rel]) {
      const r = await nativeFetch(path + '.gz', { signal: init.signal || request?.signal });
      if (!r.ok) return r;
      return new Response(r.body.pipeThrough(new DecompressionStream('gzip')), { headers: { 'Content-Type': m.gz[rel] } });
    }
    return nativeFetch(path + url.search, { signal: init.signal || request?.signal, cache: init.cache || request?.cache });
  };
})();
