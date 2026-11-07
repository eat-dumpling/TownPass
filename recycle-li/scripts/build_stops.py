#!/usr/bin/env python3
"""建置垃圾車停靠點：data.taipei「臺北市垃圾車點位路線資訊」→ web/public/data/stops/{行政區}.json

用法：
  python3 scripts/build_stops.py --rid <data.taipei 資源 id>      # 從 API 抓
  python3 scripts/build_stops.py --csv 下載的檔案.csv              # 或用手動下載的 CSV

輸出欄位與 web/src/domain/types.ts 的 Stop 相同；時間轉成「當天第幾分鐘」。
同時印出每個里、每班車的點數統計（SPEC 待確認事項）。

⚠️ 狀態：未實測。開發機連 data.taipei API 時曾被重設連線；欄位名稱請先對照實際資料再調 COLS。
"""
import argparse, csv, io, json, os, sys, urllib.request
from collections import defaultdict

OUT = os.path.join(os.path.dirname(__file__), '..', 'web', 'public', 'data', 'stops')
API = 'https://data.taipei/api/v1/dataset/{rid}?scope=resourceAquire&limit=1000&offset={offset}'

# 實際欄位名稱待確認；每個欄位列出可能的名稱
COLS = {
    'district': ['行政區'], 'li': ['里別', '里名'], 'team': ['分隊'], 'car': ['車號'],
    'route': ['路線'], 'trip': ['車次'], 'arrive': ['抵達時間'], 'leave': ['離開時間'],
    'name': ['地點'], 'lng': ['經度'], 'lat': ['緯度'],
}

def pick(row, key):
    for k in COLS[key]:
        if k in row and str(row[k]).strip() != '':
            return str(row[k]).strip()
    raise KeyError(f'找不到欄位 {key}（試過 {COLS[key]}），實際欄位：{list(row)[:20]}')

def to_min(s):
    s = s.replace(':', '').zfill(4)  # '1630' 或 '16:30'
    return int(s[:2]) * 60 + int(s[2:4])

def fetch_api(rid):
    rows, offset = [], 0
    while True:
        with urllib.request.urlopen(API.format(rid=rid, offset=offset), timeout=30) as r:
            data = json.load(r)['result']
        rows += data['results']
        offset += len(data['results'])
        if not data['results'] or offset >= data['count']:
            return rows

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--rid')
    ap.add_argument('--csv')
    a = ap.parse_args()
    if a.csv:
        raw = open(a.csv, 'rb').read()
        text = raw.decode('utf-8-sig', errors='replace') if b'\xef\xbb\xbf' in raw[:3] else raw.decode('utf-8', errors='replace')
        rows = list(csv.DictReader(io.StringIO(text)))
    elif a.rid:
        rows = fetch_api(a.rid)
    else:
        sys.exit('請給 --rid 或 --csv')

    stops = []
    for r in rows:
        try:
            stops.append({
                'route': pick(r, 'route'), 'trip': pick(r, 'trip'), 'arrive': to_min(pick(r, 'arrive')),
                'leave': to_min(pick(r, 'leave')), 'name': pick(r, 'name'), 'lat': float(pick(r, 'lat')),
                'lng': float(pick(r, 'lng')), 'district': pick(r, 'district'), 'li': pick(r, 'li'),
            })
        except (KeyError, ValueError) as e:
            print('skip', e, file=sys.stderr)

    # 依「路線＋車次」分組、依抵達時間排序，還原每班車的停靠順序
    trips = defaultdict(list)
    for s in stops:
        trips[(s['district'], s['route'], s['trip'])].append(s)
    by_district = defaultdict(list)
    for (d, route, trip), ss in trips.items():
        ss.sort(key=lambda s: s['arrive'])
        for i, s in enumerate(ss, 1):
            s['seq'] = i
            s['id'] = f'{route}-{trip}-{i}'
            by_district[d].append(s)

    os.makedirs(OUT, exist_ok=True)
    for d, ss in by_district.items():
        with open(os.path.join(OUT, f'{d}.json'), 'w', encoding='utf-8') as f:
            json.dump({'mock': False, 'source': '臺北市垃圾車點位路線資訊（data.taipei）', 'stops': ss}, f, ensure_ascii=False)
    # 統計：每個里有幾班車、每班幾個點
    per_li = defaultdict(set)
    for s in stops:
        per_li[(s['district'], s['li'])].add((s['route'], s['trip']))
    sizes = sorted(len(v) for v in trips.values())
    print(f'{len(stops)} 個點、{len(trips)} 班車；每班點數 min={sizes[0]} 中位數={sizes[len(sizes)//2]} max={sizes[-1]}')
    print(f'{len(per_li)} 個里；每里班次數 min={min(map(len, per_li.values()))} max={max(map(len, per_li.values()))}')

if __name__ == '__main__':
    main()
