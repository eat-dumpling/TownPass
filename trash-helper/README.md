# Taipei Trash Helper（台北垃圾生活助手）

台北通微服務原型，給剛來台北的外籍人士、外籍學生與新住民。

一般垃圾車 App 告訴你「垃圾車何時來」；這個服務告訴你 **「手上的垃圾要怎麼處理、什麼時候能丟、到了現場該怎麼做」**。

## 三個核心功能（只有這三個）

| 功能 | 使用者做什麼 | 系統回答什麼 | 資料 |
|---|---|---|---|
| 1. 這個要怎麼丟？ | 用相機對準、上傳照片，或從圖像清單選（可中英搜尋） | 一次一步：這是什麼（回收標誌顏色）→ 每個處理步驟 → 用什麼裝 → 今天可不可以丟 → 交給誰 | 臺北市環保局「資源回收分類方式」＋「回收一點通」（105 個品項） |
| 2. 今天能不能丟？ | 打開就看到 | 今天星期幾、每一類今天收不收、下次是星期幾 | 環保局分類方式的回收時間；週三、週日停收 |
| 3. 第一次倒垃圾 | 五個步驟，一次一頁 | 專用垃圾袋 → 在家分三類 → **附近的垃圾車停靠點與表定時間** → 等車 → 自己交給車 | data.taipei 臺北市垃圾車點位路線資訊（4,012 筆，2026-11-02 匯入） |

設計原則：英文與中文（越南文、印尼文已預留，選單上顯示「即將推出」）；圖像優先、文字少；一次只做一步；
沿用台北通設計規範的色票與字級（`lib/util/tp_colors.dart`）；觸控 ≥ 48px；不做遊戲化、排行榜、集點、任務。

## 快速開始

```bash
# 先準備共用的辨識資源（模型、文字向量）——在 recycle-li/web 做一次
cd recycle-li/web && npm install && npm run fetch:model

# 本服務
cd ../../trash-helper/web
npm install
npm run dev          # http://localhost:5174
npm test             # 收運日、袋子、附近停靠點的規則測試
npm run build
npm run fetch:stops  # 重新下載 data.taipei 垃圾車點位（輸出 public/data/stops.json）
```

在台北通裡開（相機要 https 或 http://localhost）：

```bash
adb reverse tcp:5174 tcp:5174
flutter run --dart-define=TRASH_HELPER_URL=http://localhost:5174/
```

「服務 › 更多」把「垃圾生活助手」加入我的服務，或從「熱門」進入。

## 和 recycle-li 的關係

這是**另一個微服務**（另一個網址、另一個服務入口），但重用已經做好、測試過的部分（唯讀引用 `recycle-li/web/src`，見 `vite.config.ts` 的 `@` alias）：

- 分類規則：`domain/catalog.ts`、`data/items.json`、`data/categories.json`（由環保局官方 CSV 產生）。
- 辨識：`vision/`（MediaPipe 物件偵測 → 顯著物體框 → 追蹤 → CLIP 在 Web Worker）。辨識的調校在 recycle-li 那邊做，這裡自動跟著更新。
- 與台北通溝通：`bridge/flutter.ts`（定位、撥打 1999；一般瀏覽器用模擬資料）。

本服務自己的部分：`src/i18n/`（中英文、成人口吻的品項說明 `notes.ts`）、`src/lib/rules.ts`（用什麼裝、什麼時候丟）、
`src/lib/stops.ts`（附近停靠點）、`src/views/`。

## AI 與模型揭露

和 recycle-li 相同：OpenAI CLIP ViT-B/32（`Xenova/clip-vit-base-patch32`，q8 ONNX，Transformers.js，WASM，MIT）與 MediaPipe EfficientDet-Lite2／Lite0（int8 TFLite，Apache-2.0），
**全部在手機上推論**，不呼叫雲端 API，不使用生成式 AI。照片與相機畫面不上傳、不保存。英文介面文字與品項說明由 AI 起草，**待人工審核**。

## 資料來源

| 資料 | 來源 | 授權 |
|---|---|---|
| 垃圾車點位路線資訊（4,012 筆：行政區、里、路線、車次、抵達與離開時間、地點、經緯度） | data.taipei（資源 id a6e90031-7ec4-4089-afb5-361a4efe7202） | 政府資料開放授權條款第 1 版 |
| 資源回收分類方式（大類、子類、回收時間、說明） | 臺北市政府環境保護局 | 政府資料開放授權條款 |
| 品項分類細則 | 臺北市環保局「回收一點通」 | 註明出處 |
| 專用垃圾袋（每公升 0.36 元）、隨袋徵收 | 臺北市環保局垃圾費隨袋徵收說明 | — |
| 未依規定排出垃圾罰鍰 1,200–6,000 元 | 廢棄物清理法第 50 條 | — |

## 第三方套件

vue 3.5（MIT）、vue-router 4（MIT）、vue-i18n 11（MIT）、@tabler/icons-vue 3（MIT）、vite／vitest／vue-tsc（MIT）、typescript（Apache-2.0）；
辨識相關套件見 recycle-li 的 README（@huggingface/transformers Apache-2.0、onnxruntime-web MIT、@mediapipe/tasks-vision Apache-2.0）。
