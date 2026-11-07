# 丟丟 TossTalk（臺北垃圾分類與收運）

臺北通（城市通）微服務，給剛到臺北的外籍人士、外籍學生與新住民。入口：**服務 → 我的服務 → 丟丟**。

**兒童模式**：首頁右上角「兒童模式」（各語言都有）切到同一套規則的兒童版「回收小里長」（`recycle-li/`，App 內建在 127.0.0.1:8791，開丟丟時一起啟動；開發時對應 :5173）。網址帶 `?from=` 讓兒童版右上角的箭頭回到丟丟；只接受本機、區網與丟丟正式網址（`recycle-li/web/src/bridge/back.ts`）。

## 主流程：「今晚要丟垃圾」（flow.js）

1. **第一次打開（#/welcome）**：按「使用我的位置」後，在手機上分析家附近：
   - 最近 3 個垃圾車停靠點與下一班時間，讓使用者選「我的垃圾車」（存成收藏）。
   - 所在行政區、里 → 大型垃圾要打的**該區清潔隊電話**、線上預約入口。
   - 錯過垃圾車時最近的**限時收受點**與開放時間。
   - 該區的**專用垃圾袋代售點**數量。
   - 再問一題「有沒有社區／管理室代收」，可選擇開啟垃圾車前 10 分鐘提醒（每個收運日一筆）。
   只保存行政區、里與選定的停靠點，不保存座標。也可以不定位，改選行政區、里。
2. **首頁**：只問「今天要丟什麼？」，用大圖格勾選手上的東西（每天、偶爾、大型三組），可搜尋或拍照加入；上方顯示「我的垃圾車」與倒數。
3. **我的丟垃圾清單（#/plan）**：依勾選自動產生步驟，可逐項打勾：
   1. 準備袋子：一般垃圾 → 專用袋（尺寸建議、去哪買）；回收、廚餘、電池各自怎麼裝。
   2. 先處理好：每件物品的拆解小圖卡（例如手搖杯：倒空 → 拆封膜、吸管 → 沖洗），多材質拆件各自去向。做法參考團隊 `kids-recycle-village` 的拆解步驟。
   3. 出門丟／交給社區：沒有社區代收時，算出「今晚 21:10 到 某路某號」與倒數、每類交給誰、建議日提醒、錯過時最近且當天有開的限時收受點；有社區代收則列出分類方式。
   4. 特別處理：大型垃圾直接撥該區清潔隊或 1999、線上預約；電池、燈管可交回收車或便利商店、超市、量販店，並列出該區的連鎖便利商店；舊衣、過期藥、噴霧罐、破玻璃各有說明。

## 介面設計

- 依《城市通入門指引》與臺北通 Figma「Town Pass UI Kit」：底色 grayscale-50 `#F1F3F4`、白卡片、主色 `#5AB4C5`、按鈕圓角 10 高 48、字級 24／18／16／14／12、PingFang TC，觸控目標至少 48 px，裝飾圖示 `aria-hidden`。
- **不使用 emoji**。所有圖示是 Tabler Icons 線條圖（`vendor/tabler/icons.js`，只打包用到的 91 個，`tools/build_trash_helper_icons.py` 產生）。
- 品項圖像參考 `kids-recycle-village` 的 ItemArt：依分類上色的圓角方塊加白色線條圖示（一般 灰、回收 藍、廚餘 黃、特殊 橘、大型 褐）。
- 文字精簡：首頁與清單用短名稱（例如「大型家具」），完整品名只在結果頁出現；每步驟一行標題，細節收進「詳情」。
- 地圖沒有即時定位時，會開在設定時選的停靠點附近。

## 多語言與語音助理

- **8 種語言**：繁體中文、English、Tiếng Việt、Bahasa Indonesia、Filipino、ภาษาไทย、한국어、日本語。首頁右上角「語言」可切換，第一次開啟依手機語言。介面字串、分類規則內容（品名、步驟、說明）與語音關鍵字都已翻譯；越、印、菲、泰、韓、日為機器輔助翻譯，缺字時退回英文。翻譯檔在 `i18n/<code>.js`，由 `tools/trash_helper_i18n_build.py` 產生（會檢查每個 `{placeholder}`）；原文用 `tools/trash_helper_i18n_export.js` 匯出。
- **語音助理**（`assistant.js`）：左下角麥克風按鈕。用任何一種語言說或打字，例如「我想丟電池」「舊衣回收箱在哪？」「便利商店可以回收什麼？」「垃圾車幾點來？」：
  - 說要丟的東西 → 直接產生丟垃圾清單，並把相關步驟**框起來**（頁面變暗、黃色外框、旁邊一張說明卡，可按「下一個」逐項看），清單本身不變。
  - 問在哪裡丟（舊衣、電池、廢藥、便利商店、藥局）→ 打開地圖的對應圖層、移到最近一點，框出地點並附說明與「Google 地圖導航」。
  - 問垃圾車時間 → 框出首頁的垃圾車卡片；問專用袋 → 打開購買說明。
  - 理解在手機上進行：比對所有語言的品名、關鍵字與問句用語，不連伺服器。
  - **先回答一句再跳頁**：例如「寶特瓶：倒空、沖洗、壓扁、拆下瓶蓋。」「最近的電池回收：萊爾富信義市府站，10 m。」「下一班垃圾車：週一 21:10，忠孝東路…」，同時朗讀。
  - **可以接著問**：記住剛剛問的東西（15 分鐘），「最近的在哪？」「那它幾點丟？」「怎麼處理？」直接接上；「還要丟…／also…」是加進現有清單，只框新加的。
  - **不確定就讓人選**：「瓶子」「紙」「袋子」等一詞多義會問「你是說哪一個？」並列出品項按鈕；完全對不到時，用相同字（中日韓）或拼法相近（拼音文字）列出最接近的品項，例如把聽錯的「店池」對到電池。辨識出來的句子可以點一下修改再送出。
  - **說話語言**：手機的語音辨識一次只聽一種語言（沒有自動偵測），所以麥克風下方有一排語言可選，預設跟畫面語言相同、會記住；例句也跟著換。iOS 支援中、英、越、印、泰、韓、日；菲律賓語沒有辨識模型，改用 English (Philippines)。
  - 語音轉文字用手機內建辨識（iOS Speech、Android SpeechRecognizer，透過 `trash_listen` 橋接，只在按下麥克風後聆聽）；瀏覽器開啟時改用 Web Speech API，不支援時只能打字。回覆可朗讀（可關閉）。
  - iOS 模擬器沒有可用的麥克風輸入，語音會停用並改為打字；語音請用實機測試。

## 現場溝通卡與雙語對照

- **現場溝通卡**（`talkcard.js`，`#/talk/<truck|store|drop|phone>`）：在垃圾車前、便利商店、限時收受點或打電話時使用。每句用大字中文給對方看，下面是使用者的語言；「唸出來」用手機內建語音以台灣華語唸出；「轉給對方看」把卡片轉 180 度。
  - **雙向**：「對方的回答」列出隊員或店員常說的話（中文給對方點），點了之後使用者看到自己語言的大字並可朗讀。打電話時則列出「可能會聽到」的話。
  - 垃圾車情境會依清單產生「這是電池，要丟哪裡？」等句子；打電話情境會帶入行政區、里與大型垃圾品項，產生預約清運的中文小抄並可直接撥打清潔隊。
  - 入口：清單的垃圾車卡片「給隊員看」、電池列「給店員看」、大型垃圾列「電話小抄」、首頁工具列，以及語音助理（「中文怎麼說」「跟店員說」…）。
- **雙語對照**：語言選單裡的「對照語言」，在品名、步驟、分類等關鍵字下方用小字顯示第二種語言，雙向可用（看護用越南文、家人看中文對照，或反過來）。元件只標 `data-pair`，由 CSS 畫出，不改版面。
  - 涵蓋首頁、清單、品項頁、拍照後的教學頁、地圖地點卡、各頁標題，以及語音助理的回覆與框選說明。
  - 拍照辨識的 107 個品項名稱與 75 則說明（原本只有中文）已翻成 6 種語言，英文說明另在 `i18n/en.js`。

## 功能

| 入口 | 做什麼 | 資料 |
|---|---|---|
| 拍一件垃圾 | 即時相機畫面：畫面上每件東西都有框和名字（回收小里長的辨識，見下方），點框或下方卡片就看處理方式；按快門列出候選讓使用者確認，也可以從相簿選照片或改用手動選擇 | 裝置端模型 + 規則表 |
| 這是什麼垃圾？ | 搜尋或從圖像格選 39 個品項 | 臺北市資源回收分類方式 |
| 結果頁 | 品項、分類、要不要專用袋（需專用袋／免專用袋／依預約交付／待確認）、丟之前怎麼處理（每步標示「官方規定」或「小建議」）、多材質拆件（各自分類與去向，未證實標「待確認」）、交給誰、何時何地、資料來源與頁面更新日 | 環保局 FAQ、分類資料 |
| 專用垃圾袋 | 誰要用、7 種容量的包裝數／整包價／最大重量／袋型、零售 3 L／14 L、環保兩用袋、雙北互收、選袋建議（標為產品建議） | 環保局專用袋介紹 |
| 去哪買 | 依行政區與店名／地址搜尋 2,421 家代售點，可撥電話（先確認） | 臺北市專用垃圾袋代售點名冊 |
| 哪裡可以丟 | 同一張地圖顯示我的位置、垃圾車停靠點、限時收受點；依分類（廚餘排除「廚餘車不停」）與「今天還趕得上」篩選；點標記或清單同步顯示詳情；手選行政區／里或搜尋地址；底圖載入失敗時清單照常可用 | 垃圾車點位、限時收受點 |
| 特殊物品地圖 | 地圖上切換「舊衣」「電池」「廢藥」「垃圾袋」圖層：顯示最近的地點、步行時間，點開看地址、電話、注意事項；清單第 4 步每項列出最近 2 處 | 舊衣回收設施據點、廢棄藥物檢收站名單、OpenStreetMap |
| Google 地圖導航 | 停靠點、收受點、特殊物品地點都可一鍵開 Google 地圖步行路線（裝了 App 就開 App）；地址推估的地點用完整地址導航 | — |
| 停靠點詳情 | 地址、路線、車次、收運星期（標示依點位備註或一般清運日推算）、預定抵離時間、接下來 3 次預定時間、市府備註、直線距離；收藏、提醒、外開地圖（只帶目的地座標） | 垃圾車點位 |
| 收藏與提醒 | 收藏停靠點（可改名稱、取消）；提醒選收運星期、提前 5／10／15／30 分鐘或自訂 1–120 分鐘、僅一次／每週／每兩週；儲存前可預覽；顯示實際排到的日期與狀態；有「1 分鐘後測試通知」 | App 本機 |

- 語言：繁體中文、英文、越南文、印尼文、菲律賓文、泰文、韓文、日文（見「多語言與語音助理」）。
- 刻意不做：遊戲化、帳號、後端資料庫、即時車輛位置（官方沒有開放這類資料）。

## 架構

```
microservices/trash_helper/
├─ index.html, style.css, config.js, i18n.js, schedule.js, app.js   純 HTML/CSS/JS，無建置步驟
├─ flow.js, v3.js, v3map.js 首次設定、首頁、清單；拍照與結果頁；地圖與收藏
├─ assistant.js            語音助理（意圖比對、導頁、框選說明）
├─ i18n/<code>.js          越、印、菲、泰、韓、日翻譯（介面、規則內容、語音關鍵字）
├─ vendor/leaflet/          Leaflet 1.9.4（BSD-2-Clause），本機隨附，不連 CDN
├─ vendor/tabler/           Tabler Icons 3.31.0 子集（MIT）
├─ data/rules.json          規則、專用袋、聯絡電話（tools/trash_helper_rules_src.py 產生）
├─ data/stops.json          4,012 個停靠點，含穩定 ID 與解析過的備註
├─ data/bag_vendors.json    代售點名冊
├─ data/dropoffs.json       限時收受點（開放時間已結構化）
├─ data/places.json         特殊物品地點：舊衣回收箱、電池回收（連鎖超商、超市）、廢藥檢收站（tools/build_trash_helper_places.py 產生）
├─ data/exceptions.json     官方公告的停收／照常收運日期（版本化，只放查得到公告的日期）
├─ data/source/             官方 CSV 快照與 manifest.json（下載日、來源修改時間、sha1）
└─ server.py                開發用靜態伺服器（port 8788）

vendor/recycle-vision/      回收小里長辨識模組（tools/trash_helper_vision/build.sh 產生；模型與 wasm 不進版控）
lib/page/trash_helper/      App 端：內建伺服器、資料、排程、提醒
lib/util/web_message_handler/trash_helper_handlers.dart   橋接訊息
```

### App 端

- **隨 App 提供、可離線**：頁面、資料與模型都打包在 App 內，由 `TrashLocalServer` 在 `127.0.0.1:8790` 提供（只接受 GET/HEAD、只讀資產、擋 `server.py`／`data/source/`）。飛航模式下仍可開啟、查分類、看停靠點清單和收藏；底圖、外部官方網頁需要網路。開發時用 `--dart-define=TRASH_HELPER_URL=http://<Mac IP>:8788/` 改連 Mac 的開發伺服器。
- **橋接**（沿用 `window.flutterObject` 的 `{name, data}` 格式，每個請求帶 `requestId` 並在回覆帶回）：

  | 名稱 | 用途 |
  |---|---|
  | （拍照） | 不經橋接：網頁直接用 WebView 的相機（`getUserMedia`）。TPWebView 只對丟丟本身的來源開放相機，不給麥克風 |
  | `trash_favorites` | `{op: list\|save\|remove\|rename}`；回傳收藏、提醒與狀態、通知權限 |
  | `trash_reminder_save` | `{reminder, preview}`；預覽或儲存並重排 |
  | `trash_reminder_cancel` | 刪除提醒並取消其通知 |
  | `trash_reminder_test` | 1 分鐘後的測試通知 |

  這些訊息只接受來自丟丟本身來源（scheme + host + port 相同）且在主框架的請求；外部網頁與 iframe 一律拒絕，不會開相機、讀寫收藏或排程。App 會用隨附的 `stops.json` 驗證每個點位 ID、星期、提前分鐘與頻率，提醒時間與通知文字都由 App 計算。
- **照片隱私**：相機畫面與相簿照片只在 WebView 裡（Web Worker）辨識，不上傳、不存檔；只把辨識出的品項 id 用在頁面上。
- **提醒排程**（`trash_schedule.dart`、`trash_reminders.dart`）：用 `flutter_local_notifications` 的 `zonedSchedule` 排「往後 8 週」的單次通知，按時間排序最多 40 則（保留 iOS 64 則上限的空間給其他通知）。每兩週以首次收運日為錨點，依臺北日曆每 14 天重複；官方停收日跳過但週期不變；只改提前分鐘不重置錨點；通知時刻已過就取下一班。App 啟動、回到前景、每次設定變更時與系統待發清單對帳：通知 ID 由「提醒 ID + 時刻」雜湊而成、落在本功能專用範圍，只取消 payload 標記為 `trash_helper` 的通知，所以重複儲存不會重複排程，也不會動到其他功能的通知。狀態（已排程／部分／權限關閉／已關閉／點位失效）以系統回報的待發清單為準。Android 用不需精確鬧鐘權限的 inexact 模式，可能晚幾分鐘。
- **點通知**：帶回丟丟的該停靠點頁（冷啟動、前景、背景都走同一路徑）；點位已不在資料中時，頁面顯示提示並連回收藏清單。
- **WebView**：`preventGestureDelay`、iOS 返回箭頭修正沿用前一版；丟丟的 WebView 在 User-Agent 加上 `TownPass-TrashHelper/1.0`，依 OSM 圖磚政策識別應用程式。

### 平台設定變更

- iOS 最低版本 15 → 16（原本給 `flutter_onnxruntime`；改用回收小里長辨識後已不需要，可改回 15）。
- `permission_handler`（MIT）：Android 的 WebView 開相機前先取得 App 相機權限；`AndroidManifest.xml` 加 `CAMERA`。
- iOS `Info.plist`：`NSAllowsLocalNetworking`（載入 App 內建的 127.0.0.1 頁面）；相機、相簿說明加上垃圾辨識用途。
- Android：`network_security_config.xml` 只允許 `127.0.0.1` 明文；`flutter_local_notifications` 排程 receiver 與 `RECEIVE_BOOT_COMPLETED`。

## 拍照辨識（沿用「回收小里長」）

拍照功能直接用 develop 分支 `recycle-li/web/src/vision`（回收小里長）的辨識，不另外訓練模型。流程和回收小里長的掃描頁相同，只拿掉遊戲與注音介面，文字用本服務原本的字型：

```text
相機每一幀 → MediaPipe 物件偵測（EfficientDet-Lite0，int8，CPU）→ 多個框（框不到時用顯著物體框或畫面中央）
          → 追蹤器（跨幀同一個 id、框平滑、標籤遲滯）
Web Worker → 每個框裁成 224×224 → SigLIP 影像模型 → 和 107 個品項比對（偵測器類別先驗、範例向量、學過的分類向量）
          → 每個框各自平均最近幾次結果 → 穩定的名字（不確定時說「可能是…」或只說類別）
```

| 項目 | 內容 |
|---|---|
| 影像模型 | `Xenova/siglip-base-patch16-224`（Google SigLIP，Apache-2.0），q8 ONNX，Transformers.js 3.8 / onnxruntime-web（MIT），WASM 單執行緒 |
| 物件偵測 | MediaPipe EfficientDet-Lite0 int8 TFLite（Apache-2.0），`@mediapipe/tasks-vision`（Apache-2.0） |
| 品項與向量 | 回收小里長的 `items.json`（107 個品項）、`text_embeds.json`、`class_weights.json`、`image_protos.json` |
| 準確率 | 回收小里長 README：真實照片測試組 1,210 張，品項第一名 73.1%、前三名 89.6%、分到對的桶 80.5% |
| 本機抽測 | 12 張 Wikimedia 授權照片（不在回收小里長訓練組的來源比對未做）：10 張第一名對應到正確的本服務品項；錯的是紙張→白板、噴霧罐→殺蟲劑空罐 |
| 大小 | 約 143 MB（SigLIP 99 MB、onnxruntime wasm 22 MB、MediaPipe wasm 22 MB、偵測器 4.6 MB），隨 App 打包，離線可用 |

- **品項對應**：`data/rv_map.json` 把回收小里長的 107 個品項對到本服務 `rules.json` 的 39 個品項（90 個），處理方式一律查本服務的規則表。
  沒有對應的 17 個（蛋殼、貝殼、牙刷、打火機…）顯示辨識出的名字，套用該品項臺北官方類別對應的本服務群組，並標示「待確認」與回收小里長的分類依據。
- **拍完之後怎麼丟**（`sort.js`，路由 `#/learn/<回收小里長品項 id>`）：直接沿用回收小里長的掃描結果頁（develop `recycle-li/web/src/views/CatchView.vue`）的說明卡：
  回收標誌類別色條與圖示 → 臺北分類 → 什麼時候 → 交給 → 先這樣做（步驟小圖）→ 小提醒；資料也用回收小里長的品項表與官方分類（`rv_categories.json`）。
  改用本服務字型、不用注音，並拿掉卡片下方的拖曳進桶、星星與獎勵。不要碰的東西（針頭、藥品）顯示停止圖示；官方說法不一致的顯示撥 1999。
  品項圖示用 `vendor/tabler/rv-icons.js`（`tools/trash_helper_vision/rv_icons.py` 產生）。
- **建置**：`zsh tools/trash_helper_vision/build.sh [git-ref]` 從 `origin/develop` 匯出 `recycle-li/web`（唯讀複本）、`npm ci`、下載模型、
  以 `tools/trash_helper_vision/entry.ts` 打包成 `vendor/recycle-vision/recycle-vision.js`。需要 Node.js（放在 `work/toolchain/node`）。來源 commit 記在 `vendor/recycle-vision/SOURCE_COMMIT`。
- **相機權限**：iOS 第一次開啟時系統會詢問相機；Android 由 App 先取得相機權限。拒絕時頁面顯示說明，仍可用相簿或手動選擇。

## 執行

```sh
source scripts/local-env.sh
python3 tools/trash_helper_rules_src.py
python3 tools/build_trash_helper_data.py              # --download 取得最新 CSV
python3 microservices/trash_helper/server.py          # 瀏覽器預覽 http://127.0.0.1:8788/
fvm flutter run                                       # App 內建頁面（127.0.0.1:8790）
fvm flutter run --dart-define=TRASH_HELPER_URL=http://<Mac 私人 IP>:8788/   # 改連開發伺服器
```

### 測試

```sh
fvm flutter test test/trash_helper                    # 排程、提醒對帳（固定時鐘、測試用點位）
/System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc \
  microservices/trash_helper/schedule.js tools/trash_helper_schedule_test.js
```

語音助理的理解：`tools/trash_helper_voice_cases.js` 有 100 多句問法和預期結果（中、英、越、日、韓）。開著開發伺服器的頁面，把檔案內容貼到瀏覽器 console，再執行 `vaRun()`，會印出「N/N ok」和答錯的句子。改了 `assistant.js` 的關鍵字或判斷規則就跑一次。

## 資料來源

| 資料 | 提供機關 | 連結 | 版本／更新 |
|---|---|---|---|
| 臺北市垃圾車點位路線資訊 | 環保局 | https://data.taipei/dataset/detail?id=6bb3304b-4f46-4bb0-8cd1-60c66dcd1cae | 來源修改 2026-10-30，資料版本 `2026-10-30-093e552d` |
| 臺北市專用垃圾袋代售點名冊 | 環保局 | https://data.taipei/dataset/detail?id=cd95ab7d-dd94-4825-a6c5-b2ea0329ff0f | 來源修改 2026-10-20，2,421 筆 |
| 臺北市垃圾資源回收、廚餘回收限時收受點 | 環保局 | https://data.taipei/dataset/detail?id=1acf38f3-1509-4cb1-898a-9b1d4f31a3af | 來源修改 2026-02-23，30 筆 |
| 臺北市資源回收分類方式 | 環保局 | https://data.taipei/dataset/detail?id=74643872-ee76-4727-bd02-d73b536eaad7 | — |
| 專用垃圾袋規格、重量與售價 | 環保局 | https://www.dep.gov.taipei/News_Content.aspx?n=9D5081C3BFCC977A&s=C7D8C02586900F63 | 頁面更新 2025-02-24 |
| 隨袋徵收／雙北互收／兩用袋 | 環保局 | 見 `data/rules.json` 的 `sources` | 2018-01-03～2026-10-25 |
| 紙容器、瓶罐、廚餘新制、大型廢棄物、收運日、彈性收受、聯絡資訊 | 環保局 | 同上 | 2025-08-07～2026-10-20 |

資料集皆依政府資料開放授權條款第 1 版。官方網頁內容於 2026-11-07 查核，每條規則在 `rules.json` 記錄來源 ID，畫面上顯示來源名稱、頁面更新日與查核日。

### 已知限制與尚未查證的內容

- 官方垃圾車資料沒有逐站星期欄位，也沒有即時車位：預設套用全市「週三、週日停收」，有星期備註的點位（例如「週一、週四收運」）改用備註；畫面標示「預定」與「依一般清運日推算」。
- 點位備註「回收車」「由回收車收運」「代清業者」等無法確定是否也收一般垃圾，標為「需確認」，不寫成確定收。
- 吸管、杯膜、紙杯、菸蒂、破玻璃：現行官方 FAQ 沒有逐項寫明，畫面標「待確認」或「需要查證」並提供清潔隊電話。
- 限時收受點有 1 筆（延平）開放時間無法判讀，畫面顯示原文並請使用者確認；收受品項多數依資料集名稱推定，已標示。
- 2027 年農曆春節停收日尚未公告，`exceptions.json` 目前只有已核實的 2026-01-01。
- 大型廢棄物各區預約表在環保局 PDF 中，App 只提供 1999、各區清潔隊總機與線上陳情系統入口。

### 特殊物品地點（data/places.json）

| 圖層 | 來源 | 筆數 | 位置 |
|---|---|---|---|
| 舊衣回收箱 | 臺北市社會福利團體(機構)設置舊衣回收設施據點（環保局，data.taipei） | 1,176 | 官方座標 |
| 電池回收 | OpenStreetMap 連鎖便利商店與超市（7-Eleven、全家、萊爾富、OK、全聯、美廉社、家樂福、愛買）。依環境部規定，販賣乾電池的業者須回收廢乾電池 | 1,848 | OSM 座標 |
| 廢藥回收 | 臺北市居家用藥安全檢查暨廢棄藥物檢收站名單（衛生局，data.taipei，113 年度） | 348／378 | 地址比對：78 筆與 OSM 同址（精確），270 筆依同路段最近門牌推估；30 筆無法定位，不上地圖 |

| 專用垃圾袋代售點 | 臺北市專用垃圾袋代售點名冊（環保局，data.taipei） | 2,172／2,421 | 863 筆與 OSM 同分店或同地址（精確），1,309 筆依同路段門牌推估；249 筆無法定位，仍在「全部代售點」清單 |

推估位置在畫面上會註明，導航一律用完整地址交給 Google 地圖。`python3 tools/build_trash_helper_places.py --download` 會重新下載並重建。

## 授權

AGPL-3.0-or-later（依競賽規定）。第三方：Leaflet（BSD-2-Clause，`vendor/leaflet/LICENSE`）、Tabler Icons（MIT，`vendor/tabler/LICENSE`）、回收小里長辨識模組（AGPL-3.0）、SigLIP 權重（Apache-2.0）、MediaPipe（Apache-2.0）、Transformers.js 與 onnxruntime-web（MIT）、OpenStreetMap 圖磚與資料（© OpenStreetMap contributors，ODbL）。
