# 回收小里長（台北通微服務）

孩子拿手機對著要丟的東西，畫面**即時框出物品並說「這是寶特瓶」**，接著清楚告訴他它是哪一類、要先倒空沖洗還是壓扁、交給哪台車。
孩子把它拖進正確的桶就拿到**星星**；讀分辨卡、考考你破關也拿星星，星星可以**蓋自己的里**。

> 這是丟丟 TossTalk 那套官方規則的**兒童模式**：一條循環——掃描（或用選的）→ 怎麼丟＋拖進桶 → 星星。不做倒垃圾相關功能（舊畫面已移除，在 git 歷史裡）。

- 完整規格：[docs/SPEC.md](docs/SPEC.md)（線上版：<https://claude.ai/artifact/HxnTALGmNC762XDavmRwv8>）
- 開發進度與分工：[TODO.md](TODO.md)
- 給 AI 開發工具的說明：repo 根目錄的 [AGENTS.md](../AGENTS.md)

> 回收工廠、清運大作戰、今晚任務、家長確認、本週報告不做（畫面已移除，求解器與測試仍保留）。

## 快速開始

```bash
cd recycle-li/web
npm install
npm run fetch:model   # 下載 SigLIP 影像模型（約 100 MB；比較用的 CLIP 約 85 MB）與物件偵測模型（Lite2 約 7.5 MB、Lite0 約 4.6 MB）到 public/models/（不進 git）
npm run dev           # http://localhost:5173，一般瀏覽器會用模擬的 flutterObject
npm test              # Vitest：求解器、規則、辨識的評分與平滑
npm run build         # 輸出 dist/
```

`text_embeds.json` 已在 repo 裡；改了 `items.json` 的 `prompts` 或新增品項後要重跑 `npm run build:embeds`，接著重跑 `npm run tune`（學過的分類向量是從文字向量出發的）。

在台北通裡開（相機要在台北通裡才能用）。相機 API 只在安全來源可用：`https://` 或 `http://localhost`，
**區網 IP 的 http（`http://192.168.x.x`）開不了相機**。開發時這樣接：

```bash
# Android 實機（USB）：把手機的 localhost:5173 轉到電腦
adb reverse tcp:5173 tcp:5173
flutter run --dart-define=RECYCLE_LI_URL=http://localhost:5173/
```

iOS 模擬器可以直接用 `http://localhost:5173/`。iOS／Android 實機（同一個 Wi-Fi）：相機要 https，用自簽憑證的開發伺服器：

```bash
cd web && mkdir -p .cert && openssl req -x509 -newkey rsa:2048 -nodes -days 30 -keyout .cert/dev-key.pem -out .cert/dev-cert.pem -subj "/CN=recycle-li-dev" -addext "subjectAltName=IP:$(ipconfig getifaddr en0),DNS:localhost"
npm run dev:https          # https://<區網 IP>:5443/
flutter run -d <裝置> --dart-define=RECYCLE_LI_URL=https://<區網 IP>:5443/
```

台北通的**除錯版**只信任區網位址的自簽憑證（`TPMicroserviceConfig.trustDevCertificate`），正式版照系統的憑證檢查。
App 裡從「服務 › 我的服務 › 丟丟」進入，按首頁右上角「兒童模式」切到回收小里長（右上角箭頭回丟丟）。

部署（Firebase Hosting）：`npm run build && firebase deploy --only hosting`（`web/firebase.json` 已備好）。

## 辨識怎麼做（全部在手機上）

像 YOLO 一樣即時框出畫面上的**每一個**東西並標上名字，例如「寶特瓶 86%・塑膠類」。

```text
相機每一幀 ──► MediaPipe 物件偵測（EfficientDet-Lite0，CPU）──► 多個框（COCO 類別：bottle、cup…）
          ──► 追蹤器：同一個東西跨幀同一個 id，框做平滑，漏幾幀不會消失
Web Worker ──► 輪流把每個框的區域（224×224）交給 SigLIP 影像模型 ──► 影像向量
          ──► 和 107 個品項的文字向量（＋範例向量）比對，偵測器類別當先驗 ──► 品項機率
          ──► 每個框各自平均最近 6 次結果；換標籤要連續兩次明顯勝出（遲滯）──► 穩定的名字
偵測器框不到東西時 ──► 顯著物體框：找畫面中央跟背景不一樣的那一塊（鋁箔包、電池這類 COCO 沒有的東西）
再框不到 ──► 畫面中央一大塊（東西拿很近、佔滿畫面時，例如水壺、電鍋）；認不出東西（牆、地板、桌面）就不畫
大型家具家電（chair、couch、bed、refrigerator、tv、laptop、microwave…）──► 畫面上沒有更小、更清楚的東西時才框（否則當背景），最多一個
```

- **模型只負責認出是哪個品項**；怎麼分類一律查 `web/src/data/items.json`（依臺北市環保局規則）。
- **為什麼比較穩**：框有追蹤與平滑；每個框把多次辨識平均起來（等於免費的多次取樣）；標籤有遲滯，不會一幀一換。
  - 「可能是 X？」、只說桶子也有遲滯：要掉到門檻的 0.8 倍以下才拿掉，X 要被明顯超過（0.08）才換成 Y；主要的框要被明顯超過（1.25 倍）才換。
    驗證（159 張、每張模擬 6 幀手晃）：開始回答後字又換掉的照片 4.4% → **1.3%**、換字次數 13 → 3，回答率與準確率不變（`src/vision/tracker.ts` 的 `STICKY`）。
  - 偵測器漏框太久（約 0.7 秒）被刪掉的框，1.3 秒內在同一個位置又出現時接回原本的辨識結果，不會變回「辨識中」重新認。
  - 框裡換了東西（前後兩次影像向量的 cosine < 0.7，例：同一隻手換拿紙杯）就重新認，不會沿用上一個東西的平均。
- **為什麼比較準**：
  1. 影像模型只看框內，不看整個亂亂的畫面。
  2. 偵測器類別當先驗（`src/vision/prior.ts`）：例如框是 bottle，就在寶特瓶、玻璃瓶、廢食用油之間比較，其他品項打折（×0.2，不是禁止）。
  3. 每個品項 3–4 句貼近臺灣生活的描述 × 6 種拍照情境模板做平均（prompt ensembling）；7 個「不是垃圾」背景類別。
  4. **範例向量**：用 TACO 與 Wikimedia Commons 的真實照片（訓練組）算出每個品項最多 8 個 768 維向量（`public/data/image_protos.json`，int8 壓縮，約 650 KB），
     孩子按「不對」選的正確答案也會存成向量；和範例很像的畫面會加分（Tip-Adapter 式）。只發布向量、不發布照片。
  5. **分類向量用真實照片學過**（`public/data/class_weights.json`），參數與「要不要回答」的門檻也用真實照片調過（`npm run tune`，見下方「準確率」），集中在 `src/vision/params.json`。
- **實測發現**：
  - CLIP q8 量化模型在 WebGPU 上輸出壞掉（任何兩張圖 cosine ≈ 0.998），所以影像模型一律用 WASM；Worker 內開多執行緒會卡住，所以固定單執行緒。
  - **物件偵測的 int8 模型在 GPU delegate 上也壞掉**：每張圖都回傳同樣的「bed 0.29」，所以寶特瓶永遠框不到、只剩背景框。改用 CPU 後，寶特瓶照片得到 bottle 0.69–0.75 的緊貼框。
- **速度**（開發機 Mac 瀏覽器，CPU）：物件偵測 Lite0 約 50–60 ms／幀、Lite2 約 150 ms（只在辨識測試室用）；SigLIP 約 0.65 s／框（CLIP 約 0.45–0.7 s），在 Worker 裡跑不卡畫面；開發機很忙時 Worker 會慢到 1–2.5 s／框。**手機實測尚未做**。
- **載入**（第一次約 130 MB：SigLIP 95 MB、onnxruntime wasm 21 MB、MediaPipe wasm 11 MB、偵測器 4.4 MB、向量 1.6 MB）：
  App 打開、首頁畫好後就在背景預先載入（`src/vision/preload.ts`；省流量模式不載），按「掃描」時多半已經好了；載入失敗會自動再試兩次。
  影像模型存在瀏覽器快取（Transformers.js 的 Cache Storage），wasm／onnx／tflite 在 Firebase Hosting 設一年快取（`firebase.json`），第二次打開不用再下載；
  也請瀏覽器保留這些資料（`navigator.storage.persist`）。載好後先用空白圖跑一次（暖機），第一次辨識不用再等初始化。
  試過但沒有採用的加速（`speed.html` 實測，SigLIP）：主執行緒 4 執行緒 210 ms／張（快 3 倍、輸出一樣，但每次辨識主執行緒卡 0.2 秒，框和偵測會頓）；
  Worker 裡或 onnxruntime proxy Worker 開多執行緒（即使 crossOriginIsolated）會卡在建立模型；WebGPU q8 輸出壞掉而且更慢；WebGPU q4f16 模型小（55 MB），但驗證照片的品項準確率掉 3.1 個百分點（`scripts/compare-dtype.mjs`）。
- 點畫面上的框或下方的卡片 → 指引頁；「不對」→ 選正確的品項並存一個範例向量。

## 準確率（真實照片，測試組）

用公開的真實照片調參，**所有數字只看測試組**（依來源照片固定切分，同一張照片的多個框不會同時出現在訓練和測試；參數與門檻只用訓練組裡再切出的驗證組選）。
資料：TACO 標註框 572 張、Wikimedia Commons 2,993 張（107 個品項，每個品項 24 張以上；回收一點通裡有多種樣子的 50 個品項 32–60 張）。搜錯的照片用「品項在零樣本前 15 名」過濾掉 454 張；訓練 1,895、測試 1,210。
（CLIP 的數字是加照片之前量的：Commons 1,033 張、測試 587。）
指標：「品項第一名」＝第一名是可接受的品項（例：TACO 的 Food waste 接受剩菜、果皮、蔬果、肉）；「分到對的桶」＝第一名品項的桶（`kind`）正確。

**正式使用 SigLIP**（`Xenova/siglip-base-patch16-224`）：

| 設定 | 測試張數 | 品項第一名 | 前三名 | 分到對的桶 |
|---|---|---|---|---|
| 零樣本（只用文字描述） | 1,210 | 59.8% | 77.6% | 68.8% |
| 加範例向量（每品項 8 個、α=30、β=12、溫度 50） | 1,210 | 68.8% | 82.7% | 77.1% |
| **學習分類向量＋範例向量**（λ=0.1、lr=0.01、600 回合、α=12、溫度 50） | 1,210 | **73.1%** | **89.6%** | **80.5%** |

測試組每一輪都變大、變難（加了更多品項與各種樣子），不同輪的數字不能直接比；同一批照片的比較看下面的 TACO 欄與「完整流程驗證」。

加照片前（Commons 1,033 張、測試 601）是 73.5%／89.7%／79.9%。

和 CLIP ViT-B/32 比較（同樣的照片與調參流程）：

| 模型 | 測試張數 | 零樣本：第一名／對的桶 | 調參後：第一名／前三名／對的桶 | TACO（人工標註，沒過濾）調參後：第一名／對的桶 |
|---|---|---|---|---|
| CLIP ViT-B/32（MIT） | 587 | 51.8%／61.8% | 64.9%／82.6%／72.6% | 57.1%／64.3% |
| **SigLIP base 224（Apache-2.0）**，加照片前 | 601 | 60.1%／67.2% | 73.5%／89.7%／79.9% | 67.7%／74.1% |
| SigLIP，第二輪（大型家具家電加照片） | 727 | 61.5%／69.3% | 75.0%／90.9%／81.2% | 68.0%／74.4% |
| SigLIP，第三輪（每個品項 24 張以上＋各種樣子） | 1,185 | 60.5%／69.0% | 73.1%／90.0%／80.0% | 65.8%／72.2% |
| **SigLIP，第四輪（加 2 個回收一點通品項，107 個品項，正式版）** | 1,210 | 59.8%／68.8% | **73.1%／89.6%／80.5%** | 64.3%／71.4% |

兩邊測試張數不同，是因為「搜錯過濾」用各自的零樣本結果；最可靠的比較是 TACO 那一欄（同樣 266 張、沒有過濾）：第一名多 10.9 個百分點。

**學習分類向量**（few-shot 線性探測）：每個品項的分類向量從文字向量出發，用訓練組照片做梯度下降（交叉熵＋λ‖w − w文字‖²，拉住不讓它離文字描述太遠），
存成 `public/data/class_weights.json`（int8，約 110 KB），手機上直接取代文字向量，速度不變。學習率太大會發散、λ 太大等於沒學，λ≈0.3、lr=0.01 最好。

### 不確定時要不要回答

只要沒把握就不亂猜。門檻用驗證組選：**顯示出來的答案至少 85% 對**，在這個條件下盡量多顯示（`params.json` 的 `SHOW_P`、`SHOW_P_MIN`、`SHOW_RATIO`、`KIND_P`、`MAYBE_P`，由 `src/vision/tracker.ts` 使用）。

| 畫面上（單張照片，測試組，SigLIP） | 佔比 | 準確率 |
|---|---|---|
| 顯示品項名稱（例：寶特瓶 86%・塑膠類） | 71.4% | 品項 88.1%、桶子 91.6% |
| 只顯示桶子（品項不確定但桶子很確定） | 3.2% | 桶子 92.3% |
| 「可能是 X？」 | 3.0% | 品項 63.9% |
| 不回答（只畫主要的框，可以改用「用選的」） | 22.4% | — |

顯示出來（含「可能是」）但桶子錯的 **7.3%**（全部都回答時是 19.5%）。CLIP 在同樣的 85% 條件下只能顯示 50.6% 的照片。
即時掃描時每個框會平均最近 6 次結果，信心會比單張照片高。

信心可信度（單張照片，SigLIP）：第一名機率 ≥ 0.5 的佔 64.8%，其中品項對 89.8%；0.3–0.5 佔 16.6%，品項對 58.2%；低於 0.3 的大多不可靠。

新加的 2 個品項（測試組）：行李箱 9 張品項對 6 張（認錯的多半說成手推車）；原子筆、梳子等小東西 8 張品項對 3 張、桶子對 5 張（東西太雜，還需要更多照片）。

### 手拿照片的完整流程驗證（和手機同一套程式）

上面是「單張裁好的圖」的準確率。為了驗證實際掃描的樣子，另外從 Wikimedia Commons 找「手拿著／生活情境」的照片跑**完整流程**：
物件偵測 → 選框 → 追蹤 → 影像模型（每個框用 3 種略為不同的裁切，模擬連續 3 幀）→ 決定怎麼回答。
程式在 `src/vision/evalPipeline.ts`，畫框與回答的規則在 `src/vision/pipeline.ts`（和 ScanView 共用）。

**驗證照片要先用眼睛看過**：Commons 的一般搜尋是全文比對說明文字，第一版的 113 張裡有將近一半根本不是那個東西
（「plastic bottle」搜到古希臘陶瓶 plastic aryballos、「battery」搜到炮兵連、「tissue」搜到生物組織、「snack bag」搜到羅馬陶壺把手）。
現在改用標題搜尋（`intitle:`）＋標題關鍵字檢查，下載後再逐張看過，搜錯的寫進 `data/commons_hand_reject.txt`（重跑會跳過並補新的）。
目前 71 個品項共 291 張（其餘 36 個品項在 Commons 找不到不和訓練照片重複、又真的拍到那個東西的照片，需要在家拍），
和訓練照片不重複，出處在 `data/commons_hand_attribution.csv`。這一輪自動搜尋的 277 張裡有 150 張搜錯被剔除（例：「針頭」搜到示意圖、「舊衣」搜到大樓外觀）。

| 完整流程（SigLIP） | 第三輪，286 張 | 同一批 159 張：第二輪 → 第三輪 |
|---|---|---|
| 每張平均框數 | 1.06 | 1.06 → 1.10 |
| 有回答（品項名稱、「可能是 X？」或只說桶子） | **80.1%** | 80.5% → 78.0% |
| 回答的品項對／桶子對 | **88.2%／93.0%** | 80.5%／89.8% → **87.1%／92.7%** |
| 說錯（佔全部照片） | 9.5% | 15.7% → **10.1%** |
| **看一次就說出名字**（其中品項對） | **55.2%（96.8%）** | 56.6%（91.1%）→ 51.6%（98.8%） |
| 東西佔滿畫面、靠畫面中央框認出來 | 23 張（其中 18 張說出名字、17 張對） | — |

第四輪（107 個品項，正式版）：全部 291 張有回答 78.7%、回答的品項對 88.2%、桶子對 92.1%、看一次就說 49.1%（96.5% 對）；
同樣那 286 張和第三輪幾乎一樣（說錯的都是 9.4%；`FAST_P` 變嚴，看一次就說從 55.2% 降到 49.3%）。新品項：行李箱 2/2 說對；原子筆、梳子 1/3 說對、另外 2 張沒回答（沒有說錯）。

各品項看得出的弱點：保溫瓶（3 張裡 2 張認不出或說成寶特瓶）、乾淨塑膠袋、鋁箔包、報紙、衛生紙；36 個品項沒有驗證照片（剩菜、茶渣、布丁杯、保麗龍、體溫計、平板、雜誌、紙袋、毛巾…）。

大型家具家電以前完全認不到：偵測器把 chair、couch、bed、refrigerator、tv、laptop… 當背景丟掉，所以從來不會框它們、模型也就沒機會看。
現在這些類別也框（`src/vision/pipeline.ts` 的 `BIG_CLASSES`），但畫面上有更小、更清楚的東西（例：桌上的杯子）時仍當背景；並補上對應的先驗（chair → 桌椅、refrigerator → 冰箱…）與每個品項 20 張訓練照片。

之前在沒有清理的照片上量到「只有三分之一會回答、回答的六成對」，主要是照片本身搜錯，不是模型的問題；在那組照片上做的「偵測器常把寶特瓶叫 vase」的判斷也是錯的（那些其實是陶瓶）。

**快速回答（常見的東西認得比較快）**：即時掃描平常要看 2 次才說出名字（SigLIP 在開發機每次約 0.65 秒）。
第一次就很有把握時直接說：模型機率 ≥ `FAST_P`（目前 0.75，溫度 50；由 `npm run tune` 選：單張照片測試組有 45.6% 會走這條，品項對 96.6%），
常見品項（items.json `freq` 3：杯子、瓶罐、袋子、果皮…）另外選門檻 `FAST_P_COMMON`（同樣至少 93% 對；這一輪和 `FAST_P` 一樣是 0.75），
或偵測器的類別也同意（例：偵測器說 cup、模型說紙杯）且機率 ≥ `FAST_P_AGREE`（0.6）。紙杯、寶特瓶、手搖杯、鋁罐這類常見的東西大多走這條，
等待時間大約少一半；加這條規則前後，一般大小的 103 張整體準確率相同（有回答 68.9%、品項對 83.1%）。完整流程驗證裡 55.2% 的照片看一次就說出名字，96.8% 對。程式在 `src/vision/tracker.ts` 的 `isFast`。

重跑完整流程驗證：

```bash
cd recycle-li/web
node scripts/fetch-commons.mjs --set hand      # 手拿照片 → ../testdata/hand（不進 git）
npx vite build -c vite.eval.config.ts && npx vite preview -c vite.eval.config.ts
# 開 http://localhost:4174/review.html                （逐張看驗證照片，搜錯的標題寫進 data/commons_hand_reject.txt）
#    http://localhost:4174/eval.html?select=1           （完整流程驗證；結果在 window.__ev）
#    http://localhost:4174/eval.html?select=0&legacy=1&other=0.2 （舊的畫框規則，比較用）
```

文字模板比較（只加範例向量時的品項第一名）：home 56.6%、加上「丟在地上」情境的 trash 57.0%、只有一句的 plain 55.0%——差距在誤差內，保留適合家中情境的 home。

限制：
- TACO 多是戶外地上、壓扁或髒的垃圾，和家裡拍的情境不同；Commons 是搜尋結果，有些不是典型的樣子。
- Commons 部分用零樣本前 15 名過濾搜錯，數字會略為偏高；TACO 部分沒有過濾，比較可靠。
- 這是影像模型認「品項」的準確率；App 的偵測器類別先驗、多幀平均與「不對」修正沒有算進來。最後仍要用自己在家拍的照片（`testdata/photos/`）驗證。

重跑：

```bash
cd recycle-li/web
mkdir -p ../testdata/taco && curl -L -o ../testdata/taco/annotations.json https://raw.githubusercontent.com/pedropro/TACO/master/data/annotations.json
npm run fetch:taco                 # TACO 640px 縮圖 → 裁切
npm run fetch:commons              # Wikimedia Commons（只收 CC0／PD／CC BY／CC BY-SA）→ testdata/web/attribution.csv
npm run tune                       # 第一次要算全部照片的向量比較久，之後約 5 分鐘 → src/vision/params.json、public/data/class_weights.json、image_protos.json、testdata/cache/tune-report.md
```

## AI 與模型揭露

| 用途 | 模型 | 版本／格式 | 推論框架 | 授權 | 來源 |
|---|---|---|---|---|---|
| 認出是哪個品項（**正式使用**） | Google SigLIP base patch16 224（`Xenova/siglip-base-patch16-224`，原始權重 `google/siglip-base-patch16-224`），只用影像模型 | q8 量化 ONNX（`onnx/vision_model_quantized.onnx`，約 100 MB），輸出 768 維 pooler_output | Transformers.js 3.8.1（onnxruntime-web，WASM 單執行緒，Web Worker） | Apache-2.0 | <https://huggingface.co/Xenova/siglip-base-patch16-224> |
| 文字向量（只在建置時） | 同上，文字模型（補到 64 個 token） | fp32 ONNX | Transformers.js（Node） | Apache-2.0 | 同上 |
| 比較用（可切回） | OpenAI CLIP ViT-B/32（`Xenova/clip-vit-base-patch32`） | q8 量化 ONNX，512 維 | 同上 | MIT | <https://huggingface.co/Xenova/clip-vit-base-patch32> |
| 框出物品 | MediaPipe Object Detector：EfficientDet-Lite0（即時掃描）、Lite2（辨識測試室） | int8 TFLite，CPU | @mediapipe/tasks-vision 0.10.35 | Apache-2.0 | <https://ai.google.dev/edge/mediapipe/solutions/vision/object_detector> |

- 全部在手機的 WebView 內推論，不呼叫任何雲端 API，App 執行時不使用生成式 AI；模型與 wasm 都放在自己的網站，開飛航模式也能用。
- 為什麼換成 SigLIP：同一批測試照片上品項第一名 64.9% → 73.5%、分到對的桶 72.6% → 79.9%（見「準確率」）；Google 出品、Apache-2.0，符合開源寬鬆授權與非大陸廠牌的規定。手機上的模型檔從約 85 MB 變成約 100 MB，每框稍慢。
- 切換模型：`src/vision/params.json` 的 `MODEL`（`siglip` 或 `clip`），再用同一個模型重跑 `npm run build:embeds` 與 `npm run tune`（兩者沒加 `--model` 時都跟著 `MODEL`）。
- 不使用：Apple MobileCLIP（權重授權限研究用途）、Chinese-CLIP（大陸廠牌，競賽規則禁止）。
- 準確率：見下方「準確率」。自己拍的照片放 `testdata/photos/`，跑 `npm run eval:photos`；手機速度在 App 的「設定 › 辨識測試室」量。
- 開發階段的 AI 使用：Claude Code 協助撰寫程式與文件；家長版英文、越南文、印尼文由 AI 起草，**待母語者審核**。
- **插圖來源**：「我的里」的 17 張 2.5D 插圖（`web/src/assets/li/*.webp`：11 種建築、風車葉片與 5 種裝飾）是**開發時**用 OpenAI Codex CLI 的影像生成產生（codex-cli 0.154.0、模型 `gpt-5.6-sol`，2026-11-07），提示詞在 `scripts/gen_sprites.sh`；產生後逐張檢查，用 `scripts/key_sprites.py` 去掉洋紅背景、裁切、轉成 WebP。圖檔是靜態檔，App 執行時不會連到 OpenAI、不做任何生成。沒有插圖的東西用向量模型（`web/src/components/iso/models.ts`，手寫 SVG）。

## 字型與注音（孩子介面）

- 孩子看的文字都是「國字＋直排注音」（`web/src/components/Zy.vue`），家長頁不標。設定裡可以切成只有國字。
- 字型：**全字庫正楷體**（TW-Kai 11510.1）的子集，只留 App 用到的約 1,100 字、注音符號與標點（`web/src/assets/fonts/tw-kai-subset.woff2`，約 600 KB）。出處：數位發展部，CNS11643中文標準交換碼全字庫網站，<https://www.cns11643.gov.tw>，依「政府資料開放授權條款－第 1 版」使用。不用教育部標準楷書，因為它是 CC BY-ND（不能取子集），整個字型檔太大。
- 讀音：每個字的臺灣讀音來自全字庫字音資料（同一出處與授權）；多音字先用 pinyin-pro（MIT，只在建置時）挑預設，再用人工審過的詞表（`web/src/zhuyin/words.ts`：垃圾 ㄌㄜˋ ㄙㄜˋ、里長 ㄓㄤˇ、乾淨 ㄍㄢ…）。一、不標本調，跟國小課本一樣。字表由 `web/scripts/gen-zhuyin.mjs` 產生，會檢查每個人工讀音都在全字庫裡。

## 分類規則與資料來源

分類有兩層：

1. **臺北的規則（決定哪台車、星期幾）**：依臺北市環保局「資源回收分類方式」——立體類（一般類資源物、乾淨保麗龍類）、平面類（乾淨舊衣、廢紙、塑膠袋、舊書）、
   其他類（照明燈管・電池・廢油、廚餘）、大型家具家電、不可回收。原檔 `data/taipei_recycle_categories.csv`，`scripts/build_categories.py` 產生 `web/src/data/categories.json`，
   每個品項的 `sub` 欄位指向其中一個子類別。
2. **孩子的桶（好認）**：參考回收標誌的分法與顏色——紙類、塑膠類、玻璃類、鐵鋁罐、鋁箔包・紙容器、金屬類、其他回收、一般垃圾、廚餘。
   5–8 歲只有三個桶（一般垃圾、資源回收、廚餘）。

**回收一點通 1,031 筆和品項的對應**（`scripts/map-taipei-list.mjs` → `data/taipei_list_mapping.csv`）：每筆的英文名稱用 SigLIP 文字模型和品項比，只在同一大類裡比。
898 筆對到品項（例：木椅、辦公椅 → 桌椅；冷凍櫃 → 電冰箱；不鏽鋼水壺、保溫瓶 → 金屬湯匙、剪刀、衣架〔其他金屬〕；電熱水壺 → 小家電）。
自動對應會錯（例：化妝油 → 電腦），所以訓練照片用的「各種樣子」搜尋詞是人工挑過的（`scripts/fetch-commons.mjs` 的 `VAR`）。
約 40 筆在規則表裡沒有對應品項（多是一般垃圾的小東西：原子筆筆芯、按摩梳、矽膠耳塞、浴帽），要新增品項時參考這份清單。

| 資料 | 來源 | 用在哪裡 | 狀態 |
|---|---|---|---|
| 資源回收分類方式（大類、子類、回收時間、說明欄列出的每一種東西） | 臺北市政府環境保護局（機關代碼 379150000I 等） | `categories.json`；說明欄的每一項都建成品項（`scripts/expand_items.py`） | 已匯入，涵蓋全部列出項目 |
| 品項分類細則 | 臺北市環保局「回收一點通」<https://dep-recycle.gov.taipei/>（非開放資料平台資料集，註明出處）；整理檔 `data/回收一點通_1031筆.tsv` | `items.json` 每筆的 `source`；1,031 筆對到品項（`data/taipei_list_mapping.csv`），同一品項的各種樣子當訓練照片的搜尋詞 | 107 條逐條比對（`scripts/verify_items.py`）：84 條 `verified`（`verified_by` 記錄第幾筆）、3 條 `conflict`、20 條 `unknown`（正式版不顯示）；898/1,031 筆有對應品項 |
| 115 年家戶廚餘新制 | 臺北市環保局公告 | 廚餘、大骨頭 | 同上 |
| 焚化廠營運管理報告 | data.gov.tw 資料集 145695 | 知識句「會送到焚化廠燒掉」 | 引用 |
| TACO（Trash Annotations in Context） | Proença & Simões (2020)，<http://tacodataset.org>，**CC BY 4.0** | 調參與範例向量（572 個標註框） | 照片不重新散布，只發布算出的向量 |
| Wikimedia Commons 照片 | <https://commons.wikimedia.org>，只收 CC0／公有領域／CC BY／CC BY-SA；每張的作者、授權、網址在 `data/commons_attribution.csv` | 調參與範例向量（約 2,900 張，每個品項 24 張以上）；驗證照片 286 張只用來驗證，逐張看過（出處 `data/commons_hand_attribution.csv`，搜錯的記在 `data/commons_hand_reject.txt`） | 照片不重新散布（不進 git、不進建置），只發布算出的向量 |

## 第三方套件

| 套件 | 版本 | 授權 |
|---|---|---|
| vue | 3.5.45 | MIT |
| vue-router | 4.6.4 | MIT |
| pinia | 3.0.4 | MIT |
| vue-i18n | 11.4.18 | MIT |
| idb-keyval | 6.3.0 | Apache-2.0 |
| @huggingface/transformers | 3.8.1 | Apache-2.0 |
| onnxruntime-web（transformers 的相依） | 1.22.0-dev | MIT |
| @mediapipe/tasks-vision | 0.10.35 | Apache-2.0 |
| @tabler/icons-vue（介面與品項圖示） | 3.50.0 | MIT |
| leaflet（暫停的清運大作戰使用） | 1.9.4 | BSD-2-Clause |
| vite、vitest、@vitejs/plugin-vue、vue-tsc | 6.4.5、3.2.7、5.2.4、2.2.12 | MIT |
| typescript | 5.8.3 | Apache-2.0 |
| pinyin-pro（只在建置時產生注音字表） | 3.29.5 | MIT |
| fontTools、Pillow（只在開發時：字型子集、插圖去背，不進 App） | 4.60.2、11.3.0 | MIT、MIT-CMU |
| 全字庫正楷體 TW-Kai（字型子集） | 11510.1 | 政府資料開放授權條款第 1 版 |
| permission_handler（Flutter） | 12.0.3（13.x 需要 compileSdk 37，先不升） | MIT |
| timezone（Flutter） | 0.11.2 | BSD-2-Clause |

## 台北通修改

| 檔案 | 改了什麼 |
|---|---|
| `lib/util/tp_web_view.dart` | 傳入 `onPermissionRequest`：只對白名單網站開放相機（不含麥克風）；Android 先向系統要相機權限；iOS 開 inline 播放 |
| `lib/util/tp_microservice_config.dart` | 新檔：服務網址（`--dart-define=RECYCLE_LI_URL`）與相機白名單（除錯版另允許本機與區網） |
| `lib/util/web_message_handler/tp_web_message_handler.dart`、`tp_web_message_listener.dart` | `schedule_notify`、`cancel_notify` Handler（暫停的今晚任務會用到） |
| `lib/service/notification_service.dart` | 臺北時區、排程與取消通知 |
| `lib/page/city_service/model/my_service_model.dart`、`trending_service_model.dart`、`assets/svg/icon_recycle_li.svg` | 服務入口 |
| `android/app/src/main/AndroidManifest.xml`、`ios/Runner/Info.plist`、`pubspec.yaml` | 相機權限與用途說明、排程通知接收器、`permission_handler`、`timezone` |

## 專案結構

```text
recycle-li/
  docs/SPEC.md   TODO.md
  data/          taipei_recycle_categories.csv（官方分類，UTF-8）、回收一點通_1031筆.tsv
  testdata/      photos/（測試照）、train/（範例照）——命名規則見各自的 README
  prompts/       Codex CLI 生圖清單 assets.csv
  scripts/       build_categories.py、expand_items.py（官方 CSV → 品項）、build_stops.py、build_li.py、tsv_to_csv.py
  web/
    scripts/     fetch-model、build-embeds、build-protos、eval-photos、gen-icons、copy-ort
    src/vision/  detector.ts（MediaPipe）、tracker.ts（多物件追蹤與標籤遲滯）、prior.ts（偵測器類別先驗）、
                 clip.ts＋clip.worker.ts（SigLIP／CLIP，params.json 的 MODEL 決定）、annotate.ts（YOLO 風格標註）、protos.ts（「不對」的修正）
    src/domain/  catalog.ts（臺北大類、孩子的桶、交給誰、星期幾）
    src/data/    items.json、categories.json、questions.json …
    src/solvers/ ask.ts（OR① 線索）＋暫停功能用的 factory、tsptw、chase
    src/views/   首頁、掃描、選圖與線索、指引、分類指南、品項卡、圖鑑、考考你、設定、辨識測試室
```

## 隱私與兒童安全

- 不需要兒童帳號、不收集兒童個資；進度與修正向量存在手機的 IndexedDB，不上傳。
- 相機畫面只在記憶體中辨識，不上傳、不存檔；離開掃描畫面就關閉相機。
- 設定與 Boss 怪確認要先通過大人題。
- 需要大人的品項是「Boss 怪」（家長確認才收服）；針頭、藥品直接顯示「不要碰，請大人處理」；官方說法衝突的品項顯示「請洽清潔隊」與 1999。

## 授權

競賽作品以 AGPL-3.0 開源（`web/package.json` 標示 `AGPL-3.0-only`）；台北通本身為 GPL-3.0。AGPL 全文見 `recycle-li/LICENSE`。主辦指定的授權聲明：**待補**。
