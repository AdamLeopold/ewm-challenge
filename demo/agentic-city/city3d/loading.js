// Bundle filenames contain a content hash, so cached bytes remain valid.
const assetCache = globalThis.caches
  ? caches.open('agentic-city-assets-v1').catch(() => null)
  : Promise.resolve(null);

async function fetchImmutable(url) {
  const cache = await assetCache;
  if (cache) {
    try {
      const stored = await cache.match(url);
      if (stored) return stored;
    } catch { /* Storage restrictions must not block the city. */ }
  }
  const response = await fetch(url, {cache: 'force-cache'});
  if (cache && response.ok) {
    try { await cache.put(url, response.clone()); }
    catch { /* Fall back to HTTP caching if storage is unavailable or full. */ }
  }
  return response;
}

export async function pruneAssetCache(files) {
  const cache = await assetCache;
  if (!cache) return;
  const keep = new Set(files.map(file => new URL('./web-assets/' + file, location.href).href));
  const prefix = new URL('./web-assets/', location.href).href;
  try {
    for (const request of await cache.keys()) {
      if (request.url.startsWith(prefix) && !keep.has(request.url)) await cache.delete(request);
    }
  } catch { /* Cache maintenance is optional. */ }
}

export async function get(url, type = 'json', immutable = false) {
  const response = immutable ? await fetchImmutable(url) : await fetch(url);
  if (!response.ok) throw new Error(`${url}: ${response.status}`);
  return response[type]();
}

export const nextFrame = () => new Promise(resolve => setTimeout(resolve, 0));

export async function loadPack(pack, consume) {
  if (typeof DecompressionStream === 'undefined') {
    // Older browsers can still use the unmodified source geometry.
    for (const entry of pack.entries) {
      const bytes = await get(`../${entry.source}`, 'arrayBuffer');
      await consume(entry, bytes, 0);
      await nextFrame();
    }
    return;
  }
  const response = await fetchImmutable(`./web-assets/${pack.file}`);
  if (!response.ok) throw new Error(`${pack.file}: ${response.status}`);
  let bytes;
  try {
    bytes = await new Response(response.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
    if (bytes.byteLength !== pack.rawBytes) throw new Error(`Incomplete city bundle: ${pack.file}`);
  } catch (error) {
    const cache = await assetCache;
    if (cache) await cache.delete(`./web-assets/${pack.file}`).catch(() => {});
    throw error;
  }
  for (const entry of pack.entries) {
    await consume(entry, bytes, entry.offset);
    await nextFrame();
  }
}

export async function runQueue(items, consume, {concurrency = 4, priority = () => 0} = {}) {
  const queue = [...items];
  let failed = false;
  await Promise.all(Array.from({length: concurrency}, async () => {
    while (queue.length && !failed) {
      // Re-evaluate proximity if the visitor moves the camera during loading.
      queue.sort((a, b) => priority(a) - priority(b));
      try { await consume(queue.shift()); }
      catch (error) { failed = true; throw error; }
    }
  }));
}
