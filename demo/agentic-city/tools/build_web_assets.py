"""Build lossless, cacheable web bundles from the preserved Agentic City assets."""
import gzip
import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "city3d/web-assets"
OUT.mkdir(exist_ok=True)


def read(path):
    return json.loads((ROOT / path).read_text())


def write_json(stem, data):
    raw = json.dumps(data, ensure_ascii=False, separators=(",", ":")).encode()
    name = f"{stem}-{hashlib.sha256(raw).hexdigest()[:12]}.json"
    (OUT / name).write_bytes(raw)
    return name


def pack(stem, entries):
    packs, current, payload = [], [], bytearray()

    def flush():
        if not current:
            return
        raw = bytes(payload)
        name = f"{stem}-{hashlib.sha256(raw).hexdigest()[:12]}.bin.gz"
        compressed = gzip.compress(raw, compresslevel=9, mtime=0)
        (OUT / name).write_bytes(compressed)
        # Check the actual stored bytes, including each source slice.
        restored = gzip.decompress((OUT / name).read_bytes())
        assert restored == raw
        for entry in current:
            assert restored[entry['offset']:entry['offset'] + entry['length']] == (ROOT / entry['source']).read_bytes()
        packs.append(dict(file=name, bytes=len(compressed), rawBytes=len(raw), entries=list(current)))
        current.clear()
        payload.clear()

    for entry in entries:
        raw = (ROOT / entry['source']).read_bytes()
        if len(payload) + len(raw) > 4 * 1024 * 1024:
            flush()
        payload.extend(b'\0' * (-len(payload) % 4))
        current.append(dict(entry, offset=len(payload), length=len(raw)))
        payload.extend(raw)
    flush()
    return packs


scene = read("aligned_data/scene.json")
tiles = sorted(scene['tiles'], key=lambda t: (-(t['min'][1] + t['max'][1]), t['min'][0]))
geometry, facades = [], []
for tile in tiles:
    records = read(f"aligned_data/{tile['id']}.json")
    geometry.append(dict(tile, records=records, source=f"aligned_data/{tile['id']}.bin"))
    for index, record in enumerate(records):
        if record['kind'] == 'BUILDING':
            facades.append(dict(id=f"{tile['id']}-{index}", source=f"city3d/facade-data/{tile['id']}-{index}.bin"))

metadata = read("aligned_data/buildings_metadata.json")
display = {}
for key, item in metadata.items():
    record = {k: item[k] for k in ('type_label', 'height_m', 'surface_base_mPD') if k in item}
    record['function_assessment'] = {'label': item.get('function_assessment', {}).get('label', '')}
    record['parts'] = [{'open_canopy': True}] if any(p.get('open_canopy') for p in item.get('parts', [])) else []
    display[key] = record

surfaces = read("city3d/road-water-review/data-40/manifest.json")
surface_entries = [dict(r, source=f"city3d/road-water-review/data-40/{r['file']}") for r in surfaces['files']]
index = dict(version=1, scene={k: scene[k] for k in ('origin', 'crs', 'axis', 'tiles', 'counts')},
             metadata=write_json('buildings-display', display),
             geometry=pack('geometry', geometry), facades=pack('facades', facades),
             surfaces=pack('surfaces', surface_entries),
             surfaceInfo={k: v for k, v in surfaces.items() if k != 'files'})
name = write_json('manifest', index)
app = ROOT / 'city3d/app.js'
app.write_text(re.sub(r'manifest-[a-f0-9]+\.json', name, app.read_text()))
print(json.dumps({'manifest': name, 'metadataBytes': (OUT / index['metadata']).stat().st_size,
                  'packs': sum(len(index[k]) for k in ('geometry', 'facades', 'surfaces')),
                  'compressedBytes': sum(p['bytes'] for k in ('geometry', 'facades', 'surfaces') for p in index[k]),
                  'rawBytes': sum(p['rawBytes'] for k in ('geometry', 'facades', 'surfaces') for p in index[k])}))
