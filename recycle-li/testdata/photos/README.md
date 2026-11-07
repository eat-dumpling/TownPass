# CLIP 測試照片

放真實拍攝的臺灣常見物品照片（不要用 emoji、插圖或網路上的商品圖）。目標：至少 30 張，涵蓋每一類。

- 檔名開頭寫正確的品項 id（見 `web/src/data/items.json`），例如 `bubble_tea_cup_01.jpg`、`paper_lunchbox_kitchen.jpg`。
- 一張只拍一個主要物品，放在桌上或拿在手上都可以；也拍幾張比較難的（背光、只拍一半、皺掉）。
- 不要拍到人臉、門牌、信件等個人資料。

跑測試：

```bash
cd recycle-li/web
node scripts/eval-photos.mjs            # 讀 ../testdata/photos，輸出 Markdown 報告
node scripts/eval-photos.mjs --md > ../testdata/report.md
```

手機上的實際速度請在台北通裡開 `#/lab`（設定 › 辨識測試室）量。
