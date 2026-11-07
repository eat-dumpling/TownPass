#!/usr/bin/env python3
"""Build the Trash Helper data files from official Taipei open data.

Outputs (microservices/trash_helper/data/):
  stops.json        garbage-truck stops with stable IDs and parsed stop notes
  bag_vendors.json  official garbage-bag vendors (店名, 行政區, 地址, 電話)
  dropoffs.json     limited-time drop-off points with structured opening hours

Sources (all 臺北市政府環境保護局, data.taipei, 政府資料開放授權條款第1版):
  臺北市垃圾車點位路線資訊            6bb3304b-4f46-4bb0-8cd1-60c66dcd1cae
  臺北市專用垃圾袋代售點名冊          cd95ab7d-dd94-4825-a6c5-b2ea0329ff0f
  臺北市垃圾資源回收、廚餘回收限時收受點 1acf38f3-1509-4cb1-898a-9b1d4f31a3af

Usage (from repo root):
    python3 tools/build_trash_helper_data.py            # rebuild from the bundled CSV snapshots
    python3 tools/build_trash_helper_data.py --download # fetch the latest CSVs first

A download only replaces a snapshot after it passes validation (header, row count,
coordinates). On any failure the existing snapshot and JSON stay as they are.

SPDX-License-Identifier: AGPL-3.0-or-later
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import io
import json
import re
import sys
import unicodedata
import urllib.request
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SERVICE = ROOT / 'microservices/trash_helper'
SRC = SERVICE / 'data/source'
OUT = SERVICE / 'data'
MANIFEST = SRC / 'manifest.json'
API = 'https://data.taipei/api'
UA = {'User-Agent': 'TownPass-TrashHelper-databuild/1.0'}
LICENSE = '政府資料開放授權條款第1版'
# Taipei general collection days (0 = Sunday). Wed/Sun off: DEP FAQ 市民如何排出垃圾及回收物？
GENERAL_DAYS = [1, 2, 4, 5, 6]

DATASETS = {
    'stops': {
        'dataset': '6bb3304b-4f46-4bb0-8cd1-60c66dcd1cae', 'resource': 'a6e90031-7ec4-4089-afb5-361a4efe7202',
        'file': 'taipei_garbage_truck_stops.csv', 'encoding': 'utf-8-sig', 'min_rows': 3000,
        'name': '臺北市垃圾車點位路線資訊',
        'header': ['行政區', '里別', '分隊', '局編', '車號', '路線', '車次', '抵達時間', '離開時間', '地點', '經度', '緯度'],
    },
    'vendors': {
        'dataset': 'cd95ab7d-dd94-4825-a6c5-b2ea0329ff0f', 'resource': '9edad46b-6f4f-4931-9452-2669f622060e',
        'file': 'bag_vendors_big5.csv', 'encoding': 'big5hkscs', 'min_rows': 1000,
        'name': '臺北市專用垃圾袋代售點名冊',
        'header': ['序號', '店名', '行政區', '地址', '電話', '行動電話'],
    },
    'dropoffs': {
        'dataset': '1acf38f3-1509-4cb1-898a-9b1d4f31a3af', 'resource': '0263f0ce-403a-45ed-a407-c69285b6cad2',
        'file': 'dropoff_big5.csv', 'encoding': 'big5hkscs', 'min_rows': 10,
        'name': '臺北市垃圾資源回收、廚餘回收限時收受點',
        'header': ['行政區', '分隊', '電話', '地址', '備註', '經度', '緯度'],
    },
}


def dataset_url(key: str) -> str:
    return f"https://data.taipei/dataset/detail?id={DATASETS[key]['dataset']}"


def in_taipei(lat: float, lng: float) -> bool:
    return 24.9 < lat < 25.3 and 121.4 < lng < 121.7


def clean_number(value: str) -> float:
    # One upstream row has a stray space and trailing comma, e.g. " 25.0366,".
    return float(value.strip().strip(',').strip())


def read_rows(key: str, raw: bytes) -> list[dict]:
    spec = DATASETS[key]
    text = raw.decode(spec['encoding'], errors='strict')
    reader = csv.reader(io.StringIO(text, newline=''))
    header = [h.strip() for h in next(reader)]
    if header != spec['header']:
        raise ValueError(f'{key}: unexpected header {header}')
    rows = [dict(zip(header, r)) for r in reader if len(r) >= len(header)]
    if len(rows) < spec['min_rows']:
        raise ValueError(f'{key}: only {len(rows)} rows (expected ≥ {spec["min_rows"]})')
    return rows


# ------------------------------------------------------------------ stops

def hhmm_to_minutes(value: str) -> int:
    """'1630' -> 990. Values >= 2400 are after midnight and kept as > 1440."""
    value = value.strip()
    if not value.isdigit() or len(value) not in (3, 4):
        raise ValueError(f'bad time {value!r}')
    return int(value[:-2]) * 60 + int(value[-2:])


def normalize_address(addr: str) -> str:
    a = unicodedata.normalize('NFKC', addr)
    a = re.sub(r'\s+', '', a)
    return a.removeprefix('臺北市').removeprefix('台北市')


ZH_DAY = {'日': 0, '天': 0, '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6}


def _days(text: str) -> list[int]:
    return sorted({ZH_DAY[c] for c in re.findall(r'[一二三四五六日天]', text)})


def parse_stop_note(address: str) -> dict:
    """Read the parenthesised notes in the official 地點 field.

    Returns {'days': [...]} when the note restricts the service days, 'noFood' when the
    food-waste truck does not stop, and 'confirm' when the note is about collection but
    cannot be read safely (the UI then asks the user to check instead of saying "collected").
    """
    out: dict = {}
    notes = re.findall(r'[(（]([^)）]*)[)）]', address)
    for n in notes:
        if '廚餘車不停' in n:
            out['noFood'] = True
        elif re.search(r'無收運', n):
            off = _days(n)
            out['days'] = [d for d in out.get('days', GENERAL_DAYS) if d not in off]
        elif re.fullmatch(r'(每)?(週|星期)[一二三四五六日、,.．星期週]+收運(，.*)?', n) or re.fullmatch(r'星期[一二三四五六日][.．、,]星期[一二三四五六日]', n):
            out['days'] = [d for d in _days(n.split('，')[0]) if d in GENERAL_DAYS]
        elif '回收車' in n or '代清' in n:
            # e.g. (回收車) / (由回收車收運) / (每週二,五回收車) / (一,五收代清業者垃圾):
            # the note does not say whether the garbage truck also stops here.
            out['confirm'] = True
        elif re.search(r'收運|停收|不收|僅|只收', n):
            out['confirm'] = True
    if notes:
        out['note'] = '；'.join(notes)
    return out


def build_stops(rows: list[dict], meta: dict) -> dict:
    districts: list[str] = []
    recs = []
    skipped = 0
    for rec in rows:
        try:
            lng, lat = clean_number(rec['經度']), clean_number(rec['緯度'])
            arrive, leave = hhmm_to_minutes(rec['抵達時間']), hhmm_to_minutes(rec['離開時間'])
        except ValueError:
            skipped += 1
            continue
        if not in_taipei(lat, lng):
            skipped += 1
            continue
        district = rec['行政區'].strip()
        if district not in districts:
            districts.append(district)
        address = rec['地點'].strip()
        route, trip = rec['路線'].strip(), rec['車次'].strip()
        # Stable identity: district + route + trip + normalised address. Arrival time,
        # plate number (車號) and row order are deliberately left out, so a timetable
        # change does not make a saved stop point somewhere else.
        key = f'{district}|{route}|{trip}|{normalize_address(address)}'
        recs.append({'key': key, 'district': districts.index(district), 'village': rec['里別'].strip(),
                     'address': address, 'arrive': arrive, 'leave': leave, 'lat': round(lat, 6),
                     'lng': round(lng, 6), 'route': route, 'trip': trip, 'note': parse_stop_note(address)})
    # Same identity twice (one truck stopping twice at one address on one trip): keep both,
    # numbered by arrival time, and mark them so the UI can tell them apart.
    by_key: dict[str, list] = {}
    for r in recs:
        by_key.setdefault(r['key'], []).append(r)
    dup_count = 0
    for group in by_key.values():
        group.sort(key=lambda r: r['arrive'])
        base = 's' + hashlib.sha1(group[0]['key'].encode()).hexdigest()[:10]
        for i, r in enumerate(group):
            r['id'] = base if i == 0 else f'{base}-{i + 1}'
            if len(group) > 1:
                r['note']['dup'] = i + 1
                dup_count += 1
    ids = [r['id'] for r in recs]
    assert len(ids) == len(set(ids)), 'stop IDs must be unique'
    version = hashlib.sha1(json.dumps([[r['id'], r['arrive'], r['leave']] for r in recs]).encode()).hexdigest()[:8]
    return {
        'source': {
            'name': DATASETS['stops']['name'], 'publisher': '臺北市政府環境保護局', 'url': dataset_url('stops'),
            'license': LICENSE, 'sourceModified': meta.get('last_modified'), 'downloadedOn': meta.get('downloaded_on'),
            'builtOn': date.today().isoformat(), 'skippedRows': skipped, 'duplicateIdentities': dup_count,
        },
        'version': f"{(meta.get('last_modified') or '')[:10]}-{version}",
        # Positions 0–8 are unchanged from the first release; 9 = stable id, 10 = parsed note (or 0).
        'fields': ['district', 'village', 'address', 'arriveMin', 'leaveMin', 'lat', 'lng', 'route', 'trip', 'id', 'note'],
        'generalDays': GENERAL_DAYS,
        'districts': districts,
        'stops': [[r['district'], r['village'], r['address'], r['arrive'], r['leave'], r['lat'], r['lng'],
                   r['route'], r['trip'], r['id'], r['note'] or 0] for r in recs],
    }


# ------------------------------------------------------------------ bag vendors

def build_vendors(rows: list[dict], meta: dict) -> dict:
    districts: list[str] = []
    out = []
    for r in rows:
        name, district, addr = r['店名'].strip(), r['行政區'].strip(), r['地址'].strip()
        if not (name and district and addr):
            continue
        if district not in districts:
            districts.append(district)
        phone = r['電話'].strip() or r['行動電話'].strip()
        out.append([districts.index(district), name, addr, phone])
    return {
        'source': {'name': DATASETS['vendors']['name'], 'publisher': '臺北市政府環境保護局', 'url': dataset_url('vendors'),
                   'license': LICENSE, 'sourceModified': meta.get('last_modified'), 'builtOn': date.today().isoformat(),
                   'note': '名冊沒有座標與庫存欄位；各店販售的容量以店家回覆為準。'},
        'fields': ['district', 'name', 'address', 'phone'],
        'districts': districts,
        'vendors': out,
    }


# ------------------------------------------------------------------ drop-off points

TIME_RE = re.compile(r'(\d{1,2})[：:](\d{2})\s*[~～∼至-]\s*(\d{1,2})[：:](\d{2})')
ALL = [0, 1, 2, 3, 4, 5, 6]


def _ranges(text: str) -> list[list[int]]:
    return [[int(a) * 60 + int(b), int(c) * 60 + int(d)] for a, b, c, d in TIME_RE.findall(text)]


def parse_dropoff_hours(note: str) -> dict:
    """Turn the free-text 備註 into {weekday: [[openMin, closeMin], ...]}.

    Only patterns that appear in the official file are understood. Anything else returns
    {'confirm': True} so the app shows the raw note and asks the user to check."""
    n = unicodedata.normalize('NFKC', note).replace('周', '週').replace('\n', ' ')
    n = re.sub(r'\s+', '', n)
    sched: dict[int, list] = {}
    m = re.match(r'週三、週日開放時間為(.+?)[，,]其餘(?:開放時間為|時間正常開放)\(?(.+?)\)?(?:[，,]|$)', n)
    if m:
        wed_sun, rest = _ranges(m.group(1)), _ranges(m.group(2))
        if wed_sun and rest:
            for d in ALL:
                sched[d] = wed_sun if d in (0, 3) else rest
            return {'hours': sched}
    m = re.match(r'開放時間為週三、週日(.+)', n)
    if m and _ranges(m.group(1)):
        return {'hours': {0: _ranges(m.group(1)), 3: _ranges(m.group(1))}}
    m = re.match(r'開放時間為週一至週六(.+)', n)
    if m and _ranges(m.group(1)):
        return {'hours': {d: _ranges(m.group(1)) for d in range(1, 7)}}
    m = re.match(r'收受時間為每週([一二三四五六日、]+)上午(.+?)[，,]', n)
    if m and _ranges(m.group(2)):
        return {'hours': {d: _ranges(m.group(2)) for d in _days(m.group(1))}}
    m = re.match(r'開放時間(.+?)\(每週三、日、颱風天、停班日暫停開放\)', n)
    if m and _ranges(m.group(1)):
        return {'hours': {d: _ranges(m.group(1)) for d in ALL if d not in (0, 3)},
                'warn': '颱風天、停班日暫停開放'}
    m = re.match(r'開放時間[：:]?([0-9：:~～∼、 ]+)', n)
    if m and _ranges(m.group(1)) and '週' not in n:
        return {'hours': {d: _ranges(m.group(1)) for d in ALL}}
    return {'confirm': True}


def parse_dropoff_accepts(note: str) -> tuple[list[str], str]:
    n = unicodedata.normalize('NFKC', note)
    if '一般垃圾及資源回收物' in n and '不含廚餘' in n:
        return ['general', 'recycle'], 'note'
    if re.search(r'僅收受(使用)?專用垃圾袋之一般垃圾', n):
        return ['general'], 'note'
    # The note does not list items; the dataset title says 垃圾、資源回收、廚餘.
    return ['general', 'recycle', 'food'], 'title'


def build_dropoffs(rows: list[dict], meta: dict) -> dict:
    out = []
    for r in rows:
        try:
            lng, lat = clean_number(r['經度']), clean_number(r['緯度'])
        except ValueError:
            continue
        if not in_taipei(lat, lng):
            continue
        note = r['備註'].strip()
        squad = re.sub(r'\s+', '', r['分隊'])
        parsed = parse_dropoff_hours(note)
        accepts, basis = parse_dropoff_accepts(note)
        addr = r['地址'].strip()
        out.append({
            'id': 'd' + hashlib.sha1(f"{r['行政區'].strip()}|{squad}|{normalize_address(addr)}".encode()).hexdigest()[:10],
            'district': r['行政區'].strip(), 'squad': squad, 'phone': r['電話'].strip(), 'address': addr,
            'lat': round(lat, 6), 'lng': round(lng, 6), 'note': note,
            'hours': {str(k): v for k, v in parsed.get('hours', {}).items()},
            'confirm': bool(parsed.get('confirm')), 'warn': parsed.get('warn'),
            'accepts': accepts, 'acceptsBasis': basis,
        })
    return {
        'source': {'name': DATASETS['dropoffs']['name'], 'publisher': '臺北市政府環境保護局', 'url': dataset_url('dropoffs'),
                   'license': LICENSE, 'sourceModified': meta.get('last_modified'), 'builtOn': date.today().isoformat(),
                   'officialPage': 'https://www.dep.gov.taipei/News_Content.aspx?n=00CB5204D6AA86C0&s=558A0802F34F8F11'},
        'points': out,
    }


# ------------------------------------------------------------------ main

def fetch(url: str) -> bytes:
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as resp:
        return resp.read()


def download(key: str, manifest: dict) -> None:
    spec = DATASETS[key]
    info = json.loads(fetch(f"{API}/frontstage/tpeod/dataset.view?id={spec['dataset']}"))['payload']
    res = next(r for r in info['resources'] if r['rid'] == spec['resource'])
    raw = fetch(f"{API}/dataset/{spec['dataset']}/resource/{spec['resource']}/download")
    rows = read_rows(key, raw)  # raises -> snapshot untouched
    (SRC / spec['file']).write_bytes(raw)
    manifest[key] = {'dataset': spec['dataset'], 'resource': spec['resource'], 'file': spec['file'],
                     'encoding': spec['encoding'], 'last_modified': res.get('last_modified'),
                     'downloaded_on': date.today().isoformat(), 'rows': len(rows),
                     'sha1': hashlib.sha1(raw).hexdigest()}
    print(f'Downloaded {spec["file"]}: {len(rows)} rows, modified {res.get("last_modified")}')


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('--download', action='store_true', help='download the latest CSVs from data.taipei first')
    args = parser.parse_args()
    manifest = json.loads(MANIFEST.read_text(encoding='utf-8')) if MANIFEST.exists() else {}
    if args.download:
        for key in DATASETS:
            try:
                download(key, manifest)
            except Exception as e:  # keep the old snapshot
                print(f'!! {key}: download/validation failed ({e}); keeping the existing snapshot', file=sys.stderr)
        MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=1), encoding='utf-8')

    builders = {'stops': (build_stops, 'stops.json'), 'vendors': (build_vendors, 'bag_vendors.json'),
                'dropoffs': (build_dropoffs, 'dropoffs.json')}
    failed = False
    for key, (fn, name) in builders.items():
        try:
            raw = (SRC / DATASETS[key]['file']).read_bytes()
            meta = manifest.get(key, {})
            if meta.get('sha1') and meta['sha1'] != hashlib.sha1(raw).hexdigest():
                raise ValueError('snapshot does not match manifest sha1')
            data = fn(read_rows(key, raw), meta)
        except Exception as e:
            print(f'!! {key}: {e}; {name} not rewritten', file=sys.stderr)
            failed = True
            continue
        path = OUT / name
        path.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
        count = len(data.get('stops') or data.get('vendors') or data.get('points'))
        print(f'Wrote {count} records -> {path.relative_to(ROOT)} ({path.stat().st_size} bytes)')
    if failed:
        sys.exit(1)


if __name__ == '__main__':
    main()
