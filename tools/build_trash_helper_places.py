#!/usr/bin/env python3
"""Build data/places.json: where special items go, for the Trash Helper map.

Layers
  clothes  舊衣回收箱 — 臺北市社會福利團體(機構)設置舊衣回收設施據點 (環保局, data.taipei, has coordinates)
  pills    廢棄藥物檢收站 — 臺北市居家用藥安全檢查暨廢棄藥物檢收站名單 (衛生局, data.taipei, address only)
  battery  電池回收 — chain convenience stores and supermarkets in Taipei from OpenStreetMap. Battery sellers
           must take back used dry batteries (環境部「廢乾電池」販賣業者回收義務), so every branch of these
           chains is a take-back point.

The medicine list has no coordinates. Each station is placed by, in order:
  1. an OpenStreetMap pharmacy/shop with the same street address (exact),
  2. the nearest house number on the same road/lane among geocoded addresses we already have
     (truck stops, drop-off points, OSM addresses) — marked approximate.
Navigation always uses the station's full address, so an approximate pin never sends people wrong.

Usage (from repo root):
    python3 tools/build_trash_helper_places.py            # rebuild from the bundled snapshots
    python3 tools/build_trash_helper_places.py --download # fetch data.taipei CSVs and OSM first

SPDX-License-Identifier: AGPL-3.0-or-later
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import io
import json
import math
import re
import sys
import unicodedata
import urllib.parse
import urllib.request
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SERVICE = ROOT / 'microservices/trash_helper'
SRC = SERVICE / 'data/source'
OUT = SERVICE / 'data/places.json'
MANIFEST = SRC / 'places_manifest.json'
UA = {'User-Agent': 'TownPass-TrashHelper-databuild/1.0'}
LICENSE = '政府資料開放授權條款第1版'

CSVS = {
    'clothes': {
        'dataset': '33de0950-24df-463d-b199-da3fbf612ef1', 'resource': '67d4ce6f-3137-4e6f-b490-fd127ccdff5b',
        'file': 'clothes_bins_big5.csv', 'encoding': 'big5hkscs', 'min_rows': 300,
        'name': '臺北市社會福利團體(機構)設置舊衣回收設施據點', 'publisher': '臺北市政府環境保護局',
        'header': ['核准編號', '行政區', '里別', '臺北市核准地點', '團體名稱', '電話', '經度', '緯度'],
    },
    'pills': {
        'dataset': '42f7dc80-ed79-4802-9a3e-7acefe33efa5', 'resource': '0bd3bbca-e89d-4ae9-8153-ca20da741f48',
        'file': 'medicine_takeback_big5.csv', 'encoding': 'big5hkscs', 'min_rows': 100,
        'name': '臺北市居家用藥安全檢查暨廢棄藥物檢收站名單', 'publisher': '臺北市政府衛生局',
        'header': ['序號', '類別', '檢收站名稱', '地址', '電話', '分機'],
    },
}
OSM_FILE = 'osm_shops.json'
OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter']
OVERPASS_Q = """[out:json][timeout:180];
(
  nwr["amenity"="pharmacy"](24.96,121.45,25.21,121.67);
  nwr["shop"="chemist"](24.96,121.45,25.21,121.67);
  nwr["shop"="convenience"](24.96,121.45,25.21,121.67);
  nwr["shop"="supermarket"](24.96,121.45,25.21,121.67);
);
out center tags;"""
# Chains that sell dry batteries in every branch (so must take them back).
BATTERY_CHAINS = [
    ('7-Eleven', r'7-?eleven|7-11|統一超商'), ('全家', r'全家|familymart'), ('萊爾富', r'萊爾富|hi-?life'),
    ('OK超商', r'^ok|ok超商|ok mart'), ('全聯', r'全聯'), ('美廉社', r'美廉社'), ('家樂福', r'家樂福|carrefour'),
    ('愛買', r'愛買'),
]

ZH_NUM = {'一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9, '十': 10}
DISTRICTS = ['中正區', '大同區', '中山區', '松山區', '大安區', '萬華區', '信義區', '士林區', '北投區', '內湖區', '南港區', '文山區']


def fetch(url: str, data: bytes | None = None) -> bytes:
    with urllib.request.urlopen(urllib.request.Request(url, data=data, headers=UA), timeout=240) as resp:
        return resp.read()


def read_csv(key: str, raw: bytes) -> list[dict]:
    spec = CSVS[key]
    text = raw.decode(spec['encoding'], errors='replace')
    reader = csv.reader(io.StringIO(text, newline=''))
    header = [h.strip() for h in next(reader)]
    if header != spec['header']:
        raise ValueError(f'{key}: unexpected header {header}')
    rows = [dict(zip(header, [c.strip() for c in r])) for r in reader if len(r) >= len(header)]
    if len(rows) < spec['min_rows']:
        raise ValueError(f'{key}: only {len(rows)} rows')
    return rows


# ------------------------------------------------------------------ addresses

def display_addr(addr: str) -> str:
    a = re.sub(r'\s+', '', unicodedata.normalize('NFKC', addr or ''))
    a = re.sub(r'^\d{3,6}', '', a)
    return a.removeprefix('臺北市').removeprefix('台北市')


def norm(addr: str) -> str:
    a = unicodedata.normalize('NFKC', addr or '')
    a = re.sub(r'\s+', '', a).replace('臺', '台')
    a = re.sub(r'^\d{3,6}', '', a)
    a = a.removeprefix('台灣').removeprefix('台北市')
    a = re.sub(r'([一二三四五六七八九十])段', lambda m: f'{ZH_NUM[m.group(1)]}段', a)
    return a


ADDR_RE = re.compile(r'^(?P<district>..區)?(?:[^路街道]{1,4}里)?(?:\d+鄰)?'
                     r'(?P<road>[^\d]+?(?:路|街|大道)(?:\d+段)?)(?:(?P<lane>\d+)巷)?(?:(?P<alley>\d+)弄)?'
                     r'(?P<num>\d+)(?:[之\-]\d+)?號')


def parse(addr: str) -> dict | None:
    m = ADDR_RE.match(norm(addr))
    if not m:
        return None
    d = m.groupdict()
    return {'district': d['district'], 'road': d['road'], 'lane': int(d['lane']) if d['lane'] else None,
            'alley': int(d['alley']) if d['alley'] else None, 'num': int(d['num'])}


def osm_addr(tags: dict) -> str:
    if tags.get('addr:full'):
        return tags['addr:full']
    street = tags.get('addr:street', '')
    if not street:
        return ''
    num = tags.get('addr:housenumber', '')
    if num and not num.endswith('號'):
        num += '號'
    return f"{tags.get('addr:city', '')}{tags.get('addr:district', '')}{street}{num}"


def dist_m(a: tuple, b: tuple) -> float:
    dy = (a[0] - b[0]) * 111_320
    dx = (a[1] - b[1]) * 111_320 * math.cos(math.radians(a[0]))
    return math.hypot(dx, dy)


class Geocoder:
    """Address -> coordinates from addresses we already know the position of."""

    def __init__(self):
        self.exact: dict[tuple, tuple] = {}
        self.road: dict[tuple, list] = {}

    def add(self, addr: str, lat: float, lng: float):
        p = parse(addr)
        if not p:
            return
        self.exact.setdefault((p['road'], p['lane'], p['alley'], p['num']), (lat, lng))
        # Index on the road itself: a lane's position is roughly the road's house number of that lane.
        self.road.setdefault(p['road'], []).append((p['num'] if p['lane'] is None else p['lane'], (lat, lng), p['lane']))
        if p['lane'] is not None:
            self.road.setdefault((p['road'], p['lane']), []).append((p['num'], (lat, lng), None))

    def locate(self, addr: str) -> tuple[tuple | None, str]:
        p = parse(addr)
        if not p:
            return None, 'unparsed'
        hit = self.exact.get((p['road'], p['lane'], p['alley'], p['num']))
        if hit:
            return hit, 'exact'
        if p['lane'] is not None and (p['road'], p['lane']) in self.road:
            pos = self._nearest(self.road[(p['road'], p['lane'])], p['num'], 40)
            if pos:
                return pos, 'approx'
        if p['road'] in self.road:
            key = p['lane'] if p['lane'] is not None else p['num']
            pos = self._nearest(self.road[p['road']], key, 60)
            if pos:
                return pos, 'approx'
        return None, 'nomatch'

    @staticmethod
    def _nearest(cands: list, num: int, tol: int):
        # Same side of the road first (odd/even numbers), then either side.
        same = [c for c in cands if c[0] % 2 == num % 2]
        for pool in (same, cands):
            if pool:
                best = min(pool, key=lambda c: abs(c[0] - num))
                if abs(best[0] - num) <= tol:
                    return best[1]
        return None


# ------------------------------------------------------------------ build

def in_taipei_index(stops: list) -> callable:
    grid: dict[tuple, list] = {}
    for s in stops:
        grid.setdefault((round(s[5] * 100), round(s[6] * 100)), []).append((s[5], s[6]))

    def near(lat: float, lng: float, limit: float = 700) -> bool:
        gy, gx = round(lat * 100), round(lng * 100)
        return any(dist_m((lat, lng), p) <= limit for dy in (-1, 0, 1) for dx in (-1, 0, 1) for p in grid.get((gy + dy, gx + dx), []))
    return near


def build(manifest: dict) -> dict:
    stops = json.loads((SERVICE / 'data/stops.json').read_text(encoding='utf-8'))
    drops = json.loads((SERVICE / 'data/dropoffs.json').read_text(encoding='utf-8'))
    osm = json.loads((SRC / OSM_FILE).read_text(encoding='utf-8'))['elements']
    near_taipei = in_taipei_index(stops['stops'])

    def pos_of(e):
        return (e['lat'], e['lon']) if 'lat' in e else (e['center']['lat'], e['center']['lon'])

    geo = Geocoder()
    osm_by_addr: dict[tuple, tuple] = {}
    for e in osm:
        a = osm_addr(e['tags'])
        if a:
            lat, lng = pos_of(e)
            geo.add(a, lat, lng)
            p = parse(a)
            if p:
                osm_by_addr[(p['road'], p['lane'], p['alley'], p['num'])] = (lat, lng)
    for s in stops['stops']:
        geo.add(s[2], s[5], s[6])
    for d in drops['points']:
        geo.add(d['address'], d['lat'], d['lng'])

    # --- clothes bins (official coordinates)
    clothes = []
    for r in read_csv('clothes', (SRC / CSVS['clothes']['file']).read_bytes()):
        try:
            lat, lng = float(r['緯度']), float(r['經度'])
        except ValueError:
            continue
        if not near_taipei(lat, lng, 2000):
            continue
        clothes.append([round(lat, 5), round(lng, 5), f"{r['行政區']}{r['臺北市核准地點']}", r['團體名稱'], r['電話']])

    # --- medicine take-back (geocoded)
    pills, stats = [], {'exact': 0, 'approx': 0, 'nomatch': 0, 'unparsed': 0}
    for r in read_csv('pills', (SRC / CSVS['pills']['file']).read_bytes()):
        addr = unicodedata.normalize('NFKC', r['地址']).replace(' ', '')
        pos, how = geo.locate(addr)
        stats[how] += 1
        if not pos:
            continue
        phone = r['電話'] + (f" #{r['分機']}" if r['分機'] else '')
        pills.append([round(pos[0], 5), round(pos[1], 5), r['檢收站名稱'], addr, phone,
                      0 if how == 'exact' else 1, 1 if r['類別'] == '醫院' else 0])

    # --- battery take-back (OSM chain stores)
    battery, seen = [], set()
    for e in osm:
        t = e['tags']
        if t.get('shop') not in ('convenience', 'supermarket'):
            continue
        label = f"{t.get('brand', '')} {t.get('name', '')}".lower()
        chain = next((c for c, rx in BATTERY_CHAINS if re.search(rx, label)), None)
        if not chain:
            continue
        lat, lng = pos_of(e)
        if not near_taipei(lat, lng):
            continue
        key = (round(lat, 4), round(lng, 4), chain)
        if key in seen:
            continue
        seen.add(key)
        branch = t.get('branch', '')
        name = f"{chain} {branch}".strip() if branch else (t.get('name') or chain)
        battery.append([round(lat, 5), round(lng, 5), name, display_addr(osm_addr(t))])

    # --- official garbage-bag shops (環保局代售點名冊: names and addresses, no coordinates).
    # Placed by: the same chain branch in OSM (brand + branch name), else the same street address
    # in OSM / truck stops (exact), else the nearest house number on the same road (approximate).
    def core(branch: str) -> str:
        b = unicodedata.normalize('NFKC', branch or '').replace(' ', '')
        return re.sub(r'(門市|分店|店)$', '', b)
    VENDOR_CHAINS = [('7-Eleven', r'^(?:統一超商|7-?ELEVEN)(.+)$'), ('全家', r'^全家(?:超商|便利商店)?(.+)$'), ('萊爾富', r'^萊爾富(?:超商)?(.+)$'),
                     ('OK超商', r'^OK(?:超商|便利店|mart)?(.+)$'), ('全聯', r'^全聯(?:福利中心)?(.+)$')]
    branch_pos: dict[tuple, tuple] = {}
    for e in osm:
        t = e['tags']
        if t.get('shop') not in ('convenience', 'supermarket') or not t.get('branch'):
            continue
        label = f"{t.get('brand', '')} {t.get('name', '')}".lower()
        chain = next((c for c, rx in BATTERY_CHAINS if re.search(rx, label)), None)
        if chain:
            branch_pos.setdefault((chain, core(t['branch'])), pos_of(e))
    vend = json.loads((SERVICE / 'data/bag_vendors.json').read_text(encoding='utf-8'))
    bags, bstats = [], {'branch': 0, 'exact': 0, 'approx': 0, 'nomatch': 0, 'unparsed': 0}
    for d_idx, name, addr, phone in vend['vendors']:
        name = unicodedata.normalize('NFKC', name).strip()
        guess, how = geo.locate(addr)
        pos = None
        for chain, rx in VENDOR_CHAINS:
            m = re.match(rx, name, re.I)
            if m:
                hit = branch_pos.get((chain, core(m.group(1))))
                # Same branch name, and (when we can check) near the listed address.
                if hit and near_taipei(*hit) and (not guess or dist_m(hit, guess) < 1500):
                    pos, how = hit, 'branch'
                break
        pos = pos or guess
        bstats[how] += 1
        if not pos:
            continue
        bags.append([round(pos[0], 5), round(pos[1], 5), name, display_addr(addr), phone, 0 if how in ('branch', 'exact') else 1])

    print(f"clothes {len(clothes)}, pills {len(pills)} {stats}, battery {len(battery)}, bags {len(bags)} {bstats}")
    src = lambda k: {'name': CSVS[k]['name'], 'publisher': CSVS[k]['publisher'], 'license': LICENSE,
                     'url': f"https://data.taipei/dataset/detail?id={CSVS[k]['dataset']}",
                     'sourceModified': manifest.get(k, {}).get('last_modified')}
    return {
        'builtOn': date.today().isoformat(),
        'sources': {
            'clothes': src('clothes'), 'pills': src('pills'),
            'bags': {'name': '臺北市專用垃圾袋代售點名冊', 'publisher': '臺北市政府環境保護局', 'license': LICENSE,
                     'url': 'https://data.taipei/dataset/detail?id=cd95ab7d-dd94-4825-a6c5-b2ea0329ff0f',
                     'position': 'OpenStreetMap 同分店或同地址；其餘依同路段門牌推估'},
            'battery': {'name': 'OpenStreetMap 便利商店、超市（連鎖品牌）', 'publisher': 'OpenStreetMap contributors',
                        'license': 'ODbL', 'url': 'https://www.openstreetmap.org/copyright',
                        'sourceModified': manifest.get('osm', {}).get('downloaded_on'),
                        'basis': '廢乾電池販賣業者應回收（環境部資源回收網）', 'basisUrl': 'https://recycle.moenv.gov.tw/'},
        },
        'fields': {
            'clothes': ['lat', 'lng', 'address', 'organisation', 'phone'],
            'pills': ['lat', 'lng', 'name', 'address', 'phone', 'approx', 'hospital'],
            'battery': ['lat', 'lng', 'name', 'address'],
            'bags': ['lat', 'lng', 'name', 'address', 'phone', 'approx'],
        },
        'layers': {'clothes': clothes, 'pills': pills, 'battery': battery, 'bags': bags},
    }


def download(manifest: dict) -> None:
    for key, spec in CSVS.items():
        try:
            info = json.loads(fetch(f"https://data.taipei/api/frontstage/tpeod/dataset.view?id={spec['dataset']}"))['payload']
            res = next((r for r in info.get('resources', []) if r.get('rid') == spec['resource']), {})
            raw = fetch(f"https://data.taipei/api/dataset/{spec['dataset']}/resource/{spec['resource']}/download")
            rows = read_csv(key, raw)
            (SRC / spec['file']).write_bytes(raw)
            manifest[key] = {'file': spec['file'], 'last_modified': res.get('last_modified'),
                             'downloaded_on': date.today().isoformat(), 'rows': len(rows),
                             'sha1': hashlib.sha1(raw).hexdigest()}
            print(f"Downloaded {spec['file']}: {len(rows)} rows")
        except Exception as e:
            print(f'!! {key}: {e}; keeping the existing snapshot', file=sys.stderr)
    for ep in OVERPASS:
        try:
            raw = fetch(ep, urllib.parse.urlencode({'data': OVERPASS_Q}).encode())
            n = len(json.loads(raw)['elements'])
            if n < 1000:
                raise ValueError(f'only {n} elements')
            (SRC / OSM_FILE).write_bytes(raw)
            manifest['osm'] = {'file': OSM_FILE, 'downloaded_on': date.today().isoformat(), 'elements': n,
                               'sha1': hashlib.sha1(raw).hexdigest()}
            print(f'Downloaded OSM: {n} elements from {ep}')
            break
        except Exception as e:
            print(f'!! overpass {ep}: {e}', file=sys.stderr)
    MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=1), encoding='utf-8')


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('--download', action='store_true')
    args = parser.parse_args()
    manifest = json.loads(MANIFEST.read_text(encoding='utf-8')) if MANIFEST.exists() else {}
    if args.download:
        download(manifest)
    data = build(manifest)
    OUT.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    print(f'Wrote {OUT.relative_to(ROOT)} ({OUT.stat().st_size} bytes)')


if __name__ == '__main__':
    main()
