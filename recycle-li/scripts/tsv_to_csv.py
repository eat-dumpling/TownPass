#!/usr/bin/env python3
"""把「回收一點通」1,031 筆整理檔（recycle-li/data/回收一點通_1031筆.tsv）轉成好查的 CSV，給資料組擴充品項用。

用法：python3 scripts/tsv_to_csv.py data/回收一點通_1031筆.tsv data/yidiantong.csv
欄位（推定）：flag、可否回收、類別、子項目名稱、處理方式、回收地點、說明。
回收一點通不是開放資料平台上的資料集，使用時要註明出處。
"""
import csv, sys
src, dst = sys.argv[1], sys.argv[2]
cols = ['flag', 'recyclable', 'category', 'items', 'how', 'where', 'note']
with open(src, encoding='utf-8') as f, open(dst, 'w', encoding='utf-8-sig', newline='') as g:
    w = csv.writer(g)
    w.writerow(cols)
    for line in f:
        parts = line.rstrip('\n').split('\t')
        w.writerow((parts + [''] * 7)[:7])
print('wrote', dst)
