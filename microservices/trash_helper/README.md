# Taipei Trash Helper 臺北垃圾生活助手

這是臺北通的微服務，對象是剛到臺北的外籍人士、外籍學生與新住民。它不只回答「垃圾車幾點來」，重點是說清楚**手上的垃圾怎麼處理、今天能不能丟、到現場怎麼做**。

## 功能（核心流程）

| 入口 | 做什麼 | 資料 |
|---|---|---|
| 這是什麼垃圾？ | 搜尋或從圖像格選 34 種常見品項，顯示分類（一般垃圾／資源回收／廚餘／特殊回收物／大型廢棄物）與交付方式，再一步一步帶出丟棄前的處理步驟 | 臺北市資源回收分類方式 |
| 今天能丟嗎？ | 依臺北時間判斷今天星期幾，逐類顯示「今天可以丟／今天不收／需先預約」與下次收運日；從品項進入時優先顯示該品項 | 臺北市資源回收分類方式 |
| 第一次倒垃圾 | 6 步驟圖像教學：專用垃圾袋、在家分三類、收運日、停靠點與時間、聽音樂出門、親手交給清潔車 | 環保局 FAQ、專用垃圾袋說明 |
| 附近垃圾車 | 透過臺北通 `location` 取得位置，列出最近 5 個停靠點的預定時間（已過的時間會淡化顯示）；也可以手動選行政區、里；用 OpenStreetMap 開啟地圖 | 臺北市垃圾車點位路線資訊（4,012 個停靠點） |

- 語言：英文、繁體中文。越南文、印尼文已預留，在語言選單中標示「即將推出」。
- 介面一次只顯示一個步驟，圖像優先；色彩與字級沿用臺北通 design tokens（`lib/util/tp_colors.dart`），觸控目標不小於 48px。
- 刻意不做的項目：遊戲化、集點、排行榜、帳號、後端資料庫。

## 架構

```
microservices/trash_helper/
├─ index.html, style.css, i18n.js, app.js   純 HTML/CSS/JS，無建置步驟、無第三方套件
├─ data/rules.json        分類規則與教學內容（由 tools/trash_helper_rules_src.py 產生）
├─ data/stops.json        垃圾車停靠點（由 tools/build_trash_helper_data.py 從官方 CSV 產生）
├─ data/source/*.csv      官方開放資料原始檔（保留以便重現）
└─ server.py              本機開發用靜態伺服器（port 8788）
```

- **App 端**：`lib/page/city_service/model/my_service_model.dart` 新增 `MyServiceItemId.trashHelper`（分類：城市生活），並在「我的服務」預設置頂。網址由 `lib/util/trash_helper.dart` 的 `TRASH_HELPER_URL` 控制。
- **WebView 修正**（`lib/util/tp_web_view.dart`，影響所有 WebView 服務）：開啟 `preventGestureDelay`，消除 iOS 上 Flutter 平台視圖造成的點擊延遲（實測約 230 ms，偶爾要點第二下才生效）；同頁導覽（pushState／hash）後再確認一次 `canGoBack`，避免 iOS 上已經沒有上一頁，返回箭頭卻還在、按了沒反應。
- **開發紀錄**：以 http 開發伺服器執行時，頁面會把點擊、換頁、錯誤事件送到 `server.py` 的 `/api/log` 並印在終端機，方便在實機除錯；HTTPS 部署時不會啟用，也不記錄位置。
- **橋接**：只用臺北通內建的 `location`（取得位置）與 `launch_map`（開地圖），沒有修改原生 handler。在一般瀏覽器中沒有 `flutterObject`，會改用瀏覽器定位，或由使用者手動選擇地區。
- **安全**：所有文字一律用 `textContent` 輸出，不使用 `innerHTML`；位置只在手機上計算距離，不會送到任何伺服器。
- **沒有 AI 推論**：分類完全依官方規則表比對。拍照辨識尚未實作；依競賽規則必須在裝置端推論，這部分留待之後擴充。

## 執行

```sh
# 1. 啟動微服務（iPhone 實機請改用 --host <Mac 私人 IP>）
python3 microservices/trash_helper/server.py

# 2. 執行臺北通（Android 模擬器）
adb reverse tcp:8788 tcp:8788
fvm flutter run --dart-define=TRASH_HELPER_URL=http://127.0.0.1:8788/
# iPhone：--dart-define=TRASH_HELPER_URL=http://<Mac 私人 IP>:8788/
```

在 App 中點「服務」→「我的服務」→「垃圾生活助手」。也可以直接用瀏覽器開 `http://127.0.0.1:8788/` 預覽（建議開手機模擬）。

正式部署時，把 `microservices/trash_helper/`（`server.py`、`data/source/` 除外）以靜態網站部署到 Firebase Hosting 等 HTTPS 主機，再用 `--dart-define=TRASH_HELPER_URL=https://<host>/` 建置。

### 更新資料

```sh
python3 tools/build_trash_helper_data.py --download   # 下載最新垃圾車點位並重建 stops.json
python3 tools/trash_helper_rules_src.py               # 修改規則後重建 rules.json
```

## 資料來源

| 資料集 | 提供機關 | 連結 | 授權 |
|---|---|---|---|
| 臺北市垃圾車點位路線資訊 | 臺北市政府環境保護局 | https://data.taipei/dataset/detail?id=6bb3304b-4f46-4bb0-8cd1-60c66dcd1cae | 政府資料開放授權條款第 1 版 |
| 臺北市資源回收分類方式 | 臺北市政府環境保護局 | https://data.taipei/dataset/detail?id=74643872-ee76-4727-bd02-d73b536eaad7 | 政府資料開放授權條款第 1 版 |
| 專用垃圾袋規格與價格 | 臺北市政府環境保護局 | https://www.dep.gov.taipei/News_Content.aspx?n=9D5081C3BFCC977A&s=C7D8C02586900F63 | — |
| 廚餘不分類（2026-01-01 起） | 臺北市政府環境保護局 | https://www.dep.gov.taipei/News_Content.aspx?n=D2AB82D610F8791F&sms=222A982296F669B7&s=7639C0E0E67DAFFE | — |
| 收運時間、大型廢棄物預約 FAQ | 臺北市政府環境保護局 | https://www.dep.gov.taipei/News_Content.aspx?n=ACEFA960B5A4ACD7&sms=87415A8B9CE81B16&s=402ACF2A9AD6B8EB | — |
| 罰則（廢棄物清理法第 50 條） | 法務部全國法規資料庫 | https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=O0050001 | — |

資料查核日期：2026-11-07。

### 已知限制與尚未查證的內容

- 官方垃圾車資料**沒有星期欄位**，因此所有停靠點都套用全市「週三、週日停收」規則。
- 部分處理步驟（沖洗、壓扁、拆吸管）出自環保局較舊的宣導手冊，現行 FAQ 沒有逐項列出。
- 蛋殼、披薩盒、菸蒂等品項目前沒有找到現行的官方明文規定，所以沒有放進品項清單（菸蒂依推論列為一般垃圾）。
- 罰款只寫「1,200 元起」。2026 年修法後的上限，以及臺北市新的裁罰基準，都還沒有查證。
- 農曆春節的收運時間每年另行公告，目前只顯示提醒，沒有寫死日期。

## 授權

AGPL-3.0-or-later（依競賽規定）。
