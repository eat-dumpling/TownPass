#!/usr/bin/env python3
"""Offline Taipei public CSV -> deterministic v1 snapshot + integrity manifest.

SPDX-License-Identifier: AGPL-3.0-or-later
No network access; --source-updated must come from verified publisher metadata.
"""
import argparse
import csv
import hashlib
import io
import json
from datetime import datetime, timezone
from pathlib import Path
import re
import unicodedata
from urllib.parse import urlsplit

MAX_BYTES = 10 * 1024 * 1024
ALIASES = {
    'title': ('據點名稱', '名稱', 'title', 'name'),
    'address': ('地址', '據點地址', 'address'),
    'phone': ('電話', '聯絡電話', 'phone'),
    'district': ('行政區', '區別', 'district'),
    'id': ('編號', '據點編號', 'id'),
    'body': ('據點類型', '服務內容', 'description', 'body'),
}
DISTRICTS = ('松山區', '信義區', '大安區', '中山區', '中正區', '大同區', '萬華區', '文山區', '南港區', '內湖區', '士林區', '北投區')


def clean(value):
    value = ' '.join(unicodedata.normalize('NFKC', value or '').split()).replace('台北', '臺北')
    if re.search(r'[<>\x00-\x08\x0b\x0c\x0e-\x1f]', value):
        raise ValueError('不允許標記或控制字元')
    return value


def safe_url(value, official=True):
    p = urlsplit(value)
    if (p.scheme != 'https' or not p.hostname or p.username or p.password or
            p.port not in (None, 443) or len(value) > 2048 or
            (official and p.hostname not in ('data.taipei', 'www.gov.taipei', 'www.dosw.gov.taipei'))):
        raise ValueError('必須是允許的 HTTPS 來源')
    return value


def timestamp(value):
    d = datetime.fromisoformat(value.replace('Z', '+00:00'))
    if d.tzinfo is None:
        raise ValueError('時間必須有時區')
    return d.astimezone(timezone.utc).isoformat().replace('+00:00', 'Z')


def convert(raw, dataset_id, source_url, built_at, source_updated=None, demo=False):
    if len(raw) > MAX_BYTES:
        raise ValueError('CSV 超過 10 MB')
    safe_url(source_url)
    if not re.fullmatch(r'[a-zA-Z0-9_-]{1,128}', dataset_id):
        raise ValueError('dataset-id 格式錯誤')
    try:
        text = raw.decode('utf-8-sig')
    except UnicodeDecodeError as e:
        raise ValueError('CSV 必須使用 UTF-8 或 UTF-8 BOM') from e
    reader = csv.DictReader(io.StringIO(text))
    fields = reader.fieldnames or []
    if len(fields) != len(set(fields)):
        raise ValueError('CSV 重複欄名')
    mapping = {}
    for key, aliases in ALIASES.items():
        matches = [f for f in fields if f.strip() in aliases]
        if len(matches) > 1:
            raise ValueError(f'欄位不明確：{key} -> {matches}')
        mapping[key] = matches[0] if matches else None
    if not mapping['title'] or not mapping['address']:
        raise ValueError('缺少據點名稱或地址欄位')
    docs = {}
    for line, row in enumerate(reader, 2):
        if line > 10001:
            raise ValueError('超過 10000 筆')
        if None in row or any(v is None for v in row.values()):
            raise ValueError(f'第 {line} 行欄位數不符')
        def get(key):
            return clean(row.get(mapping[key], ''))
        title, address = get('title'), get('address')
        if not title or not address or len(title) > 300 or len(address) > 500:
            raise ValueError(f'第 {line} 行缺少名稱、地址或長度超標')
        district = get('district') or next((d for d in DISTRICTS if d in address), None)
        if district and district not in DISTRICTS:
            raise ValueError(f'第 {line} 行行政區錯誤')
        identity = get('id') or hashlib.sha256(f'{title}\n{address}'.encode()).hexdigest()[:24]
        if len(identity) > 128:
            raise ValueError('ID 過長')
        body = '；'.join(v for v in (get('body'), address) if v)
        phone = get('phone') or None
        if len(body) > 5000 or (phone and len(phone) > 100):
            raise ValueError('內容過長')
        doc = dict(id=identity, title=title, body=body, district=district, address=address,
                   phone=phone, source_url=source_url,
                   source_updated_at=timestamp(source_updated) if source_updated else None,
                   source_type='fictional_test_fixture' if demo else 'taipei_open_data', is_demo=demo)
        if identity in docs and docs[identity] != doc:
            raise ValueError(f'ID 衝突：{identity}')
        docs[identity] = doc
    if not docs:
        raise ValueError('CSV 沒有資料')
    return dict(schema_version=1, dataset_id=dataset_id, source_url=source_url,
                source_updated_at=timestamp(source_updated) if source_updated else None,
                built_at=timestamp(built_at), documents=[docs[k] for k in sorted(docs)])


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--input', type=Path, required=True)
    p.add_argument('--dataset-id', required=True)
    p.add_argument('--source-url', required=True)
    p.add_argument('--output', type=Path, required=True)
    p.add_argument('--source-updated', help='經來源確認的 ISO-8601 時間，必須有時區')
    p.add_argument('--built-at', default=datetime.now(timezone.utc).isoformat())
    p.add_argument('--download-url', help='受控 HTTPS 發佈網址，未設定時 manifest 不可用於線上更新')
    p.add_argument('--demo', action='store_true', help='所有輸出標示虛構測試資料')
    a = p.parse_args()
    try:
        if a.input.stat().st_size > MAX_BYTES:
            raise ValueError('CSV 超過 10 MB')
        snapshot = convert(a.input.read_bytes(), a.dataset_id, a.source_url, a.built_at, a.source_updated, a.demo)
        payload = (json.dumps(snapshot, ensure_ascii=False, sort_keys=True, indent=2) + '\n').encode()
        if len(payload) > MAX_BYTES:
            raise ValueError('輸出超過 10 MB')
        manifest = dict(schema_version=1, dataset_id=a.dataset_id, snapshot_version=timestamp(a.built_at),
                        published_at=timestamp(a.built_at), download_url=safe_url(a.download_url, False) if a.download_url else None,
                        sha256=hashlib.sha256(payload).hexdigest(), size_bytes=len(payload))
        a.output.parent.mkdir(parents=True, exist_ok=True)
        temp = a.output.with_suffix('.tmp')
        temp.write_bytes(payload)
        temp.replace(a.output)
        a.output.with_suffix('.manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2)+'\n')
        print(f'輸出 {len(snapshot["documents"])} 筆；SHA-256 {manifest["sha256"]}')
    except (ValueError, OSError, csv.Error) as e:
        p.error(str(e))


if __name__ == '__main__':
    main()
