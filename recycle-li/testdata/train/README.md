# 範例照片（訓練用）

和 `../photos`（測試用）一樣的命名規則：檔名開頭寫品項 id，例如 `pet_bottle_kitchen_01.jpg`。
每個品項 3–5 張、不同角度與背景。**不要和測試照重複**。

```bash
cd recycle-li/web
node scripts/build-protos.mjs     # → public/data/image_protos.json（只有向量，不含照片）
```

不要拍到人臉、門牌、信件等個人資料。
