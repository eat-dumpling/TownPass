#!/usr/bin/env python3
"""建置里界與空地：臺北市里界圖（data.gov.tw 121424，TWD97）→ web/public/data/li/{行政區}.json

用法：python3 scripts/build_li.py 里界.geojson [--src-crs EPSG:3826]
需要：pip install pyproj shapely

步驟：TWD97 → WGS84、簡化邊界、在每個里內均勻取 12–20 個空地點（固定種子，全家看到的一樣）。
⚠️ 狀態：未實測。下載格式待確認；若不是 GeoJSON，改用臺北市 ArcGIS 服務的 geoJSON 查詢（見 SPEC）。
屬性欄位名稱（行政區、里名、里代碼）也要對照實際資料調整 PROPS。
"""
import argparse, json, os, random
from collections import defaultdict
from pyproj import Transformer
from shapely.geometry import shape, mapping, Point
from shapely.ops import transform

OUT = os.path.join(os.path.dirname(__file__), '..', 'web', 'public', 'data', 'li')
PROPS = {'district': ['TOWNNAME', '行政區'], 'li': ['VILLNAME', '里名'], 'code': ['VILLCODE', '里代碼']}

def prop(p, k):
    for c in PROPS[k]:
        if c in p:
            return p[c]
    raise KeyError(f'{k}: {list(p)}')

def slots(poly, n, seed):
    rnd = random.Random(seed)
    minx, miny, maxx, maxy = poly.bounds
    pts, tries = [], 0
    while len(pts) < n and tries < n * 200:
        tries += 1
        p = Point(rnd.uniform(minx, maxx), rnd.uniform(miny, maxy))
        if poly.contains(p) and all(p.distance(q) > (maxx - minx) / (n ** 0.5 * 2.5) for q in pts):
            pts.append(p)
    return [[round(p.y, 6), round(p.x, 6)] for p in pts]

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('geojson')
    ap.add_argument('--src-crs', default='EPSG:3826')
    ap.add_argument('--slots', type=int, default=12)
    a = ap.parse_args()
    to_wgs = Transformer.from_crs(a.src_crs, 'EPSG:4326', always_xy=True).transform
    gj = json.load(open(a.geojson, encoding='utf-8'))
    out = defaultdict(list)
    for f in gj['features']:
        p = f['properties']
        geom = shape(f['geometry'])
        if a.src_crs != 'EPSG:4326':
            geom = transform(to_wgs, geom)
        geom = geom.simplify(0.00005, preserve_topology=True)
        code = str(prop(p, 'code'))
        out[prop(p, 'district')].append({
            'code': code, 'name': prop(p, 'li'), 'boundary': mapping(geom), 'slots': slots(geom, a.slots, code),
        })
    os.makedirs(OUT, exist_ok=True)
    for d, lis in out.items():
        json.dump({'source': '臺北市里界圖（data.gov.tw 121424）', 'li': lis}, open(os.path.join(OUT, f'{d}.json'), 'w', encoding='utf-8'), ensure_ascii=False)
        print(d, len(lis), '個里')

if __name__ == '__main__':
    main()
