# AGENTS.md：給 AI 開發工具的專案說明

這個 repo 是台北通（TownPass，Flutter）的 fork，加上 2026 城市通微服務大黑客松作品「回收小里長」。

## 結構

- `lib/`、`android/`、`ios/`、`assets/`：台北通 App（Flutter 3.47，`.fvmrc`）。
- `recycle-li/`：微服務。規格 `recycle-li/docs/SPEC.md`，進度 `recycle-li/TODO.md`，說明 `recycle-li/README.md`。
- `recycle-li/web/`：Vue 3 + Vite + TypeScript 前端（在台北通的 WebView 內執行）。
- `microservices/trash_helper/`：另一個微服務「丟丟 TossTalk」，給外籍人士與新住民（8 種語言、一次一步、不做遊戲化），純 HTML/JS＋Leaflet。
  辨識模組由 `tools/trash_helper_vision/build.sh` 從 `recycle-li/web` 建出。說明見 `microservices/trash_helper/README.md`。

## 指令

```bash
# 微服務
cd recycle-li/web && npm install && npm run dev   # 開發
npm test                                         # Vitest
npm run typecheck && npm run build               # 型別與建置

# 台北通
flutter pub get
dart run build_runner build --delete-conflicting-outputs   # 新增 assets/svg 後一定要跑
flutter analyze lib
flutter run --dart-define=RECYCLE_LI_URL=http://<區網 IP>:5173/
```

## 今年的規則（一定要遵守）

- **AI 推論只能在裝置端**：不呼叫雲端 API、不用遠端模型。本作品只有 SigLIP（影像）與 MediaPipe EfficientDet-Lite0（框物品）在 WebView 內推論，不用生成式 AI。README 要揭露模型名稱、版本、量化格式、推論框架與來源。
- **分類只來自規則表** `recycle-li/web/src/data/items.json`；模型只負責認出品項。每條規則要有 `source`，只有 `status: "verified"` 會在正式版上線。
- **套件只用開源、免費、寬鬆授權**（MIT、BSD、Apache-2.0）。**地圖用開源方案**（Leaflet、MapLibre＋OSM 或國土測繪中心），不要用 google_maps_flutter 或 Google Maps。
- 不用危害國家資通安全清單所列的 AI 工具與模型（含大陸廠牌，例如 Chinese-CLIP）。
- 核心資料要是合法開放資料並註明出處；非核心可用模擬資料，但要標明（例如停靠點檔案的 `mock: true`）。
- 作品以 AGPL-3.0 開源；台北通本身是 GPL-3.0。

## 目前範圍（2026-11-07）

- **孩童版一條循環、一種獎勵（星星）**：掃描（或用選的）→ 怎麼丟＋拖進桶 → 星星；讀分辨卡（`views/CardView.vue`）、考考你破關（`views/LevelMapView.vue`、`QuizView.vue`，題目由 `solvers/quiz.ts` 從規則表產生）也拿星星 → 蓋我的里（`views/BuildView.vue`，大地圖隨處蓋，5 個里依等級解鎖）→ 任務與成就。星星累積決定等級（`data/ranks.json`），蓋建築不會降級；同一種東西有星星上限（`speciesCap`）。
- 孩子看的文字用 `<Zy text="…">`（國字＋直排注音，全字庫正楷體）；新增中文字後跑 `web/scripts/gen-zhuyin.mjs` 和字型子集（見 README「字型與注音」），讀音有錯就改 `src/zhuyin/words.ts`。家長頁不標注音。
- 里的插圖在 `web/src/assets/li/`（開發時用 Codex CLI 影像生成，`scripts/gen_sprites.sh`＋`key_sprites.py`）；App 執行時不能呼叫生成式 AI。新插圖要在 README「插圖來源」記錄。
- **只給孩子用、沒有家長功能**：目標是讓孩子從「看不懂垃圾分類」到「懂」。沒有設定頁、家長關卡、撥電話；分幾個桶跟著等級長大（一開始 3 個、`NINE_BINS_LEVEL` 起 9 個），注音一律開著。要大人幫忙的東西，孩子按「我會找大人」就算認出來。
- **介面**：主要畫面（家、考考你、蓋房子、圖鑑、任務）用底部選單 `KidDock`＋頂部狀態列 `KidHud`（路由 `meta.dock`）；每個功能一個顏色（家藍綠、考考你天藍、掃一掃黃、蓋房子綠、圖鑑紫）。首頁只有一句話、一個「現在做這個」按鈕。
- **不做**：線索問答（OR① 題目）、倒垃圾相關（今晚任務、家長確認、本週報告、清運大作戰）。舊畫面已移除（在 git 歷史裡）。
- 辨識（YOLO 風格多物件）：`detector.ts`（MediaPipe EfficientDet-Lite0 框物品；Lite2 只在辨識測試室）→ `tracker.ts`（追蹤、框平滑、標籤遲滯）→ `clip.worker.ts`（SigLIP 在 Web Worker；檔名沿用 clip）＋`clip.ts`（評分、範例向量）＋`prior.ts`（偵測器類別先驗）→ `annotate.ts`（畫標註）。影像模型固定 WASM 單執行緒（q8 在 WebGPU 會壞；Worker 內多執行緒會卡）。
- 品項要涵蓋臺北市環保局 CSV 說明欄的每一項；新增品項用 `recycle-li/scripts/expand_items.py`，之後重跑 `npm run build:embeds`。
- 分類兩層：臺北官方子類（`src/data/categories.json`，由 `recycle-li/data/taipei_recycle_categories.csv` 產生）＋孩子的桶（`kind`，回收標誌的分法與顏色）。

## 程式慣例

- **不要用 emoji**（介面、資料、測試都不要）。圖示用 `<AppIcon name="Xxx">`（Tabler Icons，名稱要寫成字面字串，`scripts/gen-icons.mjs` 才收得到）；品項圖用 `<ItemArt>`。
- 測模型只用真實照片（`recycle-li/testdata/photos/`、`train/`），不要用 emoji 或插圖。

- 與 App 溝通一律走 `recycle-li/web/src/bridge/flutter.ts`；一般瀏覽器沒有 `window.flutterObject`，用內建的模擬回覆。
- App 端新增能力：繼承 `TPWebMessageHandler`（`lib/util/web_message_handler/tp_web_message_handler.dart`），名稱不要和內建的重複，再加進 `TPWebMessageListener._cachedMessageHandlers`。
- 新服務入口：`lib/page/city_service/model/my_service_model.dart`；網址集中在 `lib/util/tp_microservice_config.dart`。
- 色票與字級依台北通設計規範（`lib/util/tp_colors.dart`，前端在 `recycle-li/web/src/styles/base.css`）；無障礙：觸控 ≥48dp、文字放大 200% 可讀、每頁一個標題、不用閃爍內容。
- 兒童隱私：不收集個資、相機畫面不上傳不存檔、位置用完即丟（只存停靠點編號與里名）。
- 介面以圖像為主、文字最少；不要在畫面上放說明段落。
- 改了遊戲邏輯或求解器就補 `recycle-li/web/src/solvers/*.test.ts`。
- 做完 TODO 的項目，更新 `recycle-li/TODO.md` 的勾選狀態。
