# 城市通本機 AI 建置宿主

這個入口啟動**原本的城市通首頁、底部分頁與既有功能**，再註冊真正的 llamadart 本機引擎。AI 功能在「首頁 → 城市小幫手」微服務中，不會把首頁換成聊天畫面。

名稱 `city_ai_demo` 保留為建置識別；畫面與 routing 直接使用本 repo 的 `town_pass`，不是另一份複製的城市通 UI。新功能為 PoC，非臺北市正式服務。

## 執行與操作

由 repository 根目錄：

```sh
python3 tools/build_city_ai_microservice.py
flutter pub get
dart run build_runner build --delete-conflicting-outputs
cd apps/city_ai_demo
flutter pub get
flutter run -d <device-id>
```

1. 原首頁點「城市小幫手」，或在服務清單選同名服務。
2. 先可直接查 510 筆已附的官方公開資料，無模型也能離線使用。
3. 新安裝的 App 先在設定同意下載 IBM Granite 4.0 1B；SHA-256 通過後自動使用。已有模型時直接輸入，不需開啟按鈕。
4. 可直接問「你是誰」或「台大附近美食」；問「文山區社區關懷據點」時自動參考資料，接著可問「那大安區呢？」。原生端保留最多 3 組對話，後續提問沿用檢索主題；引擎一次載入、跨問題重用。
5. 可停止、開始新對話、取消下載或刪除模型。離頁清除對話，模型在 App 前景保溫最多 90 秒供重入；背景或低記憶體時釋放。字級跟隨系統，引用卡顯示官方網址。

所有問題都走一般本機對話；檢索只是自動加入的參考資料。可以問「你是誰」、「台大附近美食」或一般生活問題，沒有 RAG 命中也會執行已開啟的本機模型。有相關資料時，回答旁會顯示經 native 驗證的官方來源。沒有安裝／開啟模型時仍能純離線查資料。

預設建議 IBM 官方 Granite 4.0 1B Q4_K_M（Apache-2.0，約 976 MiB，支援中文）；350M 與 SmolLM2 是較小的測試候選，中文回覆較弱。推論完全在手機執行，未連網查證；不應編造店名、營業時間、價格、市政資格或名額。參考資料以不可信文字處理，會拒絕明顯注入、越界引用、非來源網址及部分未支持的結構化資訊；這不等於完整語意事實驗證。Gemma 的授權與合法散布未配置，保持鎖定。

## 為何另有建置宿主

既有 TownPass 最低 iOS 15.x；llamadart Apple runtime 需要 16.4。本宿主 iOS 16.4，註冊本機 adapter 並沿用同一套原首頁。**原 repo 的 iOS 最低版本沒有提高**，原入口仍能使用同一微服務的純檢索模式。Android 本宿主實際 APK 的 minSdk 是 24，設定 arm64-v8a / x86_64；本次 native 測試為 arm64 模擬器，不能推定所有裝置都可運行。

原有 mock JSON、SVG、圖片與字型以 repo 內相對 symlink 提供同名資產，避免複製和改寫原首頁資產。Windows 建置需啟用 Git symlink 支援，或將相同目標複製到對應資產目錄。保留既有字型、TownPass、第三方授權；不代表已完成公開散布審查。

## 驗證指令

```sh
# repository 根目錄
python3 tools/build_city_ai_microservice.py
node --check microservices/city_ai/app.js
flutter test
python3 -m unittest discover -s tools/tests -v
# 本宿主目錄
dart format --output=none --set-exit-if-changed lib test integration_test test_driver
flutter analyze
flutter test --reporter expanded
flutter build apk --debug --target-platform android-arm64
flutter build ios --no-codesign
flutter test integration_test/general_conversation_test.dart -d <device-id>
flutter test integration_test/townpass_microservice_test.dart -d <device-id> --dart-define=RUN_MODEL_SMOKE=true
```

iOS 模擬器以 Mach API 實測宿主可用記憶體，實機使用 `os_proc_available_memory()`；兩者都檢查至少 2 GiB 實體記憶體；載入前可用額度至少為模型檔案大小加 256 MiB，且不低於 512 MiB；生成前再檢查 512 MiB，讀取失敗則保留純檢索。最終 iOS 微服務測試未注入資源條件，已通過真實 CPU runtime 與連續對話；此結果不等於 iPhone 真機效能驗證。

需要可檢視截圖時：

```sh
flutter drive --driver test_driver/microservice_driver.dart \
  --target integration_test/townpass_microservice_test.dart -d <device-id> \
  --dart-define=RUN_MODEL_SMOKE=true --dart-define=CAPTURE_SCREENSHOTS=true
```

general_conversation_test 使用已安裝模型測自動啟動，不會自動下載；新裝置先執行下方 Debug 預備入口，或在設定同意下載一次約 976 MiB。townpass_microservice_test 在缺模型時會經原生確認下載。Android 飛航測試由 repository 根目錄執行 `python3 tools/run_android_offline_smoke.py --device emulator-5554`，只接受 emulator serial，結束後還原網路；核心離線測試與 WebView 流程分開驗證。

首次建置下載原生 runtime。此 Mac 全域 Flutter build-dir 不適合本 repo，使用忽略的獨立 `XDG_CONFIG_HOME` 將輸出移至使用者 Library/Caches；詳見 [DEPLOYMENT](../../docs/local_ai/DEPLOYMENT.md)。Android WebView 的 AGP 9 相容修補見 [TOWNPASS_PATCH](../../third_party/flutter_inappwebview_android/TOWNPASS_PATCH.md)，未修改 pub cache。

## 公開資料與更新

來源：[臺北市銀髮族服務_社區照顧關懷據點](https://data.taipei/dataset/detail?id=d082dc87-d3fd-479d-89c6-745ff1be955a)，社會局提供。[來源與原檔 SHA-256](../../data/README.md)。資料日期與建置日期分開；虛構測試資料獨立標示。

```sh
# repository 根目錄；工具不連網
python3 tools/import_taipei_csv.py \
  --input data/raw/taipei_care_centers.csv \
  --dataset-id taipei-community-care-centers \
  --source-url 'https://data.taipei/dataset/detail?id=d082dc87-d3fd-479d-89c6-745ff1be955a' \
  --source-updated '2026-03-04T11:43:09+08:00' \
  --built-at '2026-11-05T17:21:11Z' \
  --output packages/city_ai_core/assets/knowledge/knowledge.json
```

省略未經確認的 source-updated 會顯示未知。輸出 snapshot 與 `.manifest.json`；重新建置即能更新隨附離線包。線上更新需營運方先提供受控 HTTPS host：匯入時加入 `--download-url <actual-snapshot-url>`，先發佈 snapshot、再發佈 manifest；建置時設定 `KNOWLEDGE_MANIFEST_URL`、`KNOWLEDGE_RELEASE_HOST` 兩個 dart-define。目前無實際受控主機，因此 UI 誠實顯示尚未啟用。

更新限制 HTTPS／確切主機、redirect、schema v1、大小、資料集一致與 SHA-256；驗證後原子替換、失敗保留舊包。信任根為營運方的 TLS manifest，未宣稱已有簽章離線匯入包或憑證釘選。問題從不加入更新 request。

## 原始碼與交接

- `../../microservices/city_ai`：網頁原始碼，buildless HTML/CSS/JS；打包為單一離線 App asset。
- `../../lib/features/city_ai`：原城市通入口、受限原生 bridge、WebView 容器。
- `../../packages/city_ai_core`：共享 domain / ports / RAG / 更新 / 模型管理／對話 controller。
- `lib/features/city_ai/inference`：本機 llamadart adapter；正式 UI 不使用 fake engine。

[實作狀態](../../IMPLEMENTATION_STATUS.md) · [指引與整合](../../docs/local_ai/INTEGRATION.md) · [隱私](../../docs/local_ai/PRIVACY.md) · [模型來源](../../docs/local_ai/MODEL_PROVENANCE.md) · [授權清單](../../docs/local_ai/THIRD_PARTY_NOTICES.md)。新模組採 AGPL-3.0-or-later；原 TownPass GPL-3.0 聲明保留。尚未推送、公開 repo、部署、簽章或商店發佈。

## 已預下載的測試入口

使用者已明確要求預先下載模型。以下 Debug 工具入口會先透過白名單／磁碟預檢／SHA-256／原子安裝準備 IBM Granite 4.0 1B，再開原首頁，不下載 Gemma。普通 main.dart 已能自動預熱已安裝模型，不需使用此下載工具；新裝置的下載仍由使用者同意。

```sh
cd apps/city_ai_demo
flutter run -t lib/main_preload.dart -d <device-id>
```

此 Mac 加上 `XDG_CONFIG_HOME="$PWD/../../tmp/flutter-config"`。成功時只輸出 `APPROVED_MODEL_PREPARED` 與公開模型 ID／大小／SHA，不輸出問題、回答或私有檔案路徑。模型已存在且校驗通過時直接重用。若下載失敗會如實中止準備；不假裝可用。

## 年長使用者介面

主畫面採暖白底、深色文字、20px 基準字級及至少 56px 按鈕；輸入與送出固定在下方，可直接問一般問題；市政地區選擇收在展開區。系統字級之外，可在設定選「更大」再放大 25%。模型、資料更新與校驗資訊收進設定視窗，完成後回到對話。AI 引用的來源優先顯示地址、電話與日期，其他來源及原文可展開。詳見 [設計與驗證](../../docs/local_ai/ELDER_FRIENDLY_UX.md)。

資料更新支援進度／bytes／取消；成功更換資料後會開始新對話，以免引用舊版本。取消或失敗保留舊資料與對話。生成失敗／逾時會釋放模型，純檢索不等待失敗引擎清理。

前端狀態回歸：`node --test microservices/city_ai/test/app.test.cjs`（由 repo 根目錄）；這是 DOM／bridge 狀態測試，不代替真機讀屏驗收。

## 直接對話與必要的啟動時間

正常 flutter run 使用 main.dart，原首頁首幀後背景校驗／載入已安裝模型，進入小幫手直接送出即可。載入中也能輸入，問題只在記憶體保留，完成後自動生成；停止、新對話或離頁會取消這題。重入沿用模型，不保留前頁對話。設定可選省電查詢／恢復；背景、記憶體壓力或首頁閒置 90 秒釋放。準備上限 60 秒，生成上限 45 秒，失敗保留檢索。

第一次仍需同意下載一次約 976 MiB，不會因提問自動下載。模型在尚未下載或載入前不能推論；預熱與排隊減少操作和阻擋，不是保證零冷啟動延遲。完整 SHA 在 isolate 執行，載入前再驗證，沒有省略校驗。最新社區活動需要活動資料包，現有關懷據點不是即時行事曆。
