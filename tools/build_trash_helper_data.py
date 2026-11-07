#!/usr/bin/env python3
"""Convert the official Taipei garbage-truck stop CSV into a compact JSON file
for the Trash Helper microservice.

Source: 臺北市垃圾車點位路線資訊 (臺北市政府環境保護局, data.taipei,
dataset 6bb3304b-4f46-4bb0-8cd1-60c66dcd1cae, resource a6e90031-7ec4-4089-afb5-361a4efe7202),
Open Government Data License v1.

Usage (from repo root):
    python3 tools/build_trash_helper_data.py            # use the bundled CSV
    python3 tools/build_trash_helper_data.py --download # fetch the latest CSV first

SPDX-License-Identifier: AGPL-3.0-or-later
"""
from __future__ import annotations

import argparse
import csv
import json
import urllib.request
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SERVICE = ROOT / 'microservices/trash_helper'
SOURCE_CSV = SERVICE / 'data/source/taipei_garbage_truck_stops.csv'
OUT_JSON = SERVICE / 'data/stops.json'
DOWNLOAD_URL = ('https://data.taipei/api/dataset/6bb3304b-4f46-4bb0-8cd1-60c66dcd1cae'
                '/resource/a6e90031-7ec4-4089-afb5-361a4efe7202/download')
EXPECTED_HEADER = ['行政區', '里別', '分隊', '局編', '車號', '路線', '車次',
                   '抵達時間', '離開時間', '地點', '經度', '緯度']


def clean_number(value: str) -> float:
    # One upstream row has a stray space and trailing comma, e.g. " 25.0366,".
    return float(value.strip().strip(',').strip())


def hhmm_to_minutes(value: str) -> int:
    """'1630' -> 990. Values >= 2400 are after midnight and kept as > 1440."""
    value = value.strip()
    if not value.isdigit() or len(value) not in (3, 4):
        raise ValueError(f'bad time {value!r}')
    return int(value[:-2]) * 60 + int(value[-2:])


def build(csv_path: Path) -> dict:
    with csv_path.open(encoding='utf-8-sig', newline='') as fh:
        reader = csv.reader(fh)
        header = [h.strip() for h in next(reader)]
        if header != EXPECTED_HEADER:
            raise SystemExit(f'Unexpected header: {header}')
        districts: list[str] = []
        stops = []
        skipped = 0
        for row in reader:
            if len(row) < len(EXPECTED_HEADER):
                skipped += 1
                continue
            rec = dict(zip(EXPECTED_HEADER, row))
            try:
                lng = clean_number(rec['經度'])
                lat = clean_number(rec['緯度'])
                arrive = hhmm_to_minutes(rec['抵達時間'])
                leave = hhmm_to_minutes(rec['離開時間'])
            except ValueError:
                skipped += 1
                continue
            if not (24.9 < lat < 25.3 and 121.4 < lng < 121.7):
                skipped += 1
                continue
            district = rec['行政區'].strip()
            if district not in districts:
                districts.append(district)
            # [districtIndex, village, address, arriveMin, leaveMin, lat, lng, route, trip]
            stops.append([
                districts.index(district),
                rec['里別'].strip(),
                rec['地點'].strip(),
                arrive,
                leave,
                round(lat, 6),
                round(lng, 6),
                rec['路線'].strip(),
                rec['車次'].strip(),
            ])
    return {
        'source': {
            'name': '臺北市垃圾車點位路線資訊',
            'publisher': '臺北市政府環境保護局',
            'url': 'https://data.taipei/dataset/detail?id=6bb3304b-4f46-4bb0-8cd1-60c66dcd1cae',
            'license': '政府資料開放授權條款第1版',
            'builtOn': date.today().isoformat(),
            'skippedRows': skipped,
        },
        'fields': ['district', 'village', 'address', 'arriveMin', 'leaveMin', 'lat', 'lng', 'route', 'trip'],
        'districts': districts,
        'stops': stops,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('--download', action='store_true', help='download the latest CSV from data.taipei first')
    args = parser.parse_args()
    if args.download:
        with urllib.request.urlopen(DOWNLOAD_URL, timeout=60) as resp:
            SOURCE_CSV.write_bytes(resp.read())
        print(f'Downloaded {SOURCE_CSV.relative_to(ROOT)}')
    data = build(SOURCE_CSV)
    OUT_JSON.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    print(f"Wrote {len(data['stops'])} stops ({data['source']['skippedRows']} skipped) "
          f"in {len(data['districts'])} districts -> {OUT_JSON.relative_to(ROOT)} "
          f"({OUT_JSON.stat().st_size} bytes)")


if __name__ == '__main__':
    main()
