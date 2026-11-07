#!/usr/bin/env python3
"""臺北市環保局「資源回收分類方式」CSV → web/src/data/categories.json

來源：臺北市政府環境保護局（機關代碼 379150000I 等），原檔為 Big5，已轉成 UTF-8 存在 data/taipei_recycle_categories.csv。
每個子類別給一個穩定的 id，items.json 的 sub 欄位引用它。回收時間直接來自 CSV。
"""
import csv, json, os, re

HERE = os.path.dirname(__file__)
SRC = os.path.join(HERE, '..', 'data', 'taipei_recycle_categories.csv')
OUT = os.path.join(HERE, '..', 'web', 'src', 'data', 'categories.json')

# 子類別 → 穩定 id（CSV 的「不可回收」在立體類與平面類各有一列，合併成 non_recyclable）
IDS = {
    ('立體類', '一般類資源物'): 'r3d_general',
    ('立體類', '乾淨保麗龍類'): 'r3d_foam',
    ('立體類', '不可回收'): 'non_recyclable',
    ('平面類', '乾淨舊衣類'): 'rflat_clothes',
    ('平面類', '廢紙類'): 'rflat_paper',
    ('平面類', '塑膠袋類'): 'rflat_bag',
    ('平面類', '舊書'): 'rflat_book',
    ('平面類', '不可回收'): 'non_recyclable',
    ('其他類', '照明燈管、電池、廢油類'): 'other_hazard',
    ('其他類', '廚餘類'): 'food',
    ('大型家具、家電暨四機類', '大型家具、家電暨四機類'): 'bulky',
}
WEEK = {'一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '日': 0}

def days(s):
    m = re.search(r'星期([一二三四五六日、]+)回收', s)
    return [WEEK[c] for c in m.group(1) if c in WEEK] if m else []

out = {}
with open(SRC, encoding='utf-8') as f:
    for r in csv.DictReader(f):
        key = (r['大類別'], r['子類別'])
        sid = IDS[key]
        examples = [x.strip() for x in re.split(r'[、，。]', r['說明']) if x.strip()]
        if sid in out:  # 不可回收：合併兩列
            out[sid]['examples'] += examples
            out[sid]['major'] = '不可回收'
            continue
        out[sid] = {
            'id': sid, 'major': r['大類別'] if sid != 'non_recyclable' else '不可回收', 'sub': r['子類別'],
            'days': days(r['回收時間']), 'when': r['回收時間'], 'examples': examples,
            'source': f"臺北市環保局資源回收分類方式（{r['機關代碼']}）",
        }
json.dump(list(out.values()), open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('wrote', OUT, len(out), 'categories')
