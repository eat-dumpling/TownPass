# 城市通本機 AI 微服務實作狀態

更新：2026-11-06（Asia/Taipei）。分支 local-llm-test，基底 e65b586771b67334e7a21c2aa9c6e80060e4f827。已閱讀 ZIP 的 AGENTS、CODEX_TASK、全部開發文件及補充 PDF；文件為參考，使用者後續要求優先。

## 本輪修正

最新要求：**不用按開啟，直接與本機 AI 對話**。AI 宿主在原首頁首幀之後背景預熱已安裝模型；進入小幫手不需要開啟按鈕。冷啟動時可立刻打字送出，問題在記憶體排隊，完成載入後自動生成，也能停止／清除／換題。這是隱藏並銜接必要的載入時間，不是模型能在尚未下載或載入前推論。

- App 前景共用一個 CityAiSession；離頁清除畫面與 controller 對話，保留模型最多 90 秒以供重入使用。閒置、App 背景或記憶體壓力會釋放；回前景會自動恢復。設定可主動改用省電查詢，該次 App session 不會擅自重新開啟。
- SHA 校驗在獨立 isolate 執行，未跳過大小／完整 SHA 或載入前校驗；首頁與輸入不等待整個模型校驗完成。模型準備上限 60 秒，生成上限 45 秒。
- 沒有模型仍需先經使用者同意下載一次；不自動下載 976 MiB、不繞過 Gemma 授權、不加入雲端 LLM。已安裝模型不重複下載。
- 截圖中的最新社區活動需要更新的活動資料；現有 510 筆為關懷據點，不是活動行事曆。自動啟動不代表模型知道最新活動。

依最新指示「全部就是一般問題，只是如果有可以 RAG 再 RAG」，已移除無來源就不執行模型的條件。所有問題交給已開啟的本機模型；有相關資料才加入參考與來源卡。資料包不可用也不阻擋一般對話，不需使用者選擇模式。未安裝或未開啟模型時保留純離線檢索。

- 原城市通首頁、底部分頁與導覽保留；城市小幫手仍是 App 隨附 HTML/CSS/JS 微服務。
- 年長使用者介面：暖白底、深色文字、20px 基準字級、56px 控制、固定輸入列、設定視窗及額外 25% 字級。主快捷為「認識你」、「找美食」，行政區放入「查詢市政資料」展開區。
- 一般回答標示「手機 AI 對話／未連線查證」；有資料時標示「手機 AI・資料參考」並附 native 來源卡。串流保留未改變的來源節點。
- 移除有限引文 GBNF 與逐字摘錄限制。RAG 檢查明顯注入、越界引用、非來源網址及部分結構化資訊；這不是完整語意事實驗證。
- 預設建議 IBM 官方 Granite 4.0 1B Q4_K_M，Apache-2.0、無 gate、支援中文。固定 revision、大小及 SHA；350M 與 SmolLM2 保留為測試候選，Gemma 維持鎖定。
- 大檔實際遇到連線重設，改為 32 MiB 分段、精確 Content-Range、受限重試及完整 SHA 後原子安裝。載入前依模型大小檢查原生可用記憶體。

## 各階段

| 階段 | 實作與狀態 | 剩餘限制 |
|---|---|---|
| 原首頁與繁體中文 UI | 完成；同一首頁進入微服務、大字與設定，未替換首頁 | 真機讀屏／年長使用者研究未做 |
| 離線 RAG | 完成；中文詞彙、行政區與追問、來源標題／官方網址／日期 | 510 筆真實資料，無即時活動或餐廳資料 |
| 一般本機對話 | 完成 MVP；llamadart 0.17.5 + companion 0.17.3；CPU 2 threads、context 4096、maxTokens 384、temperature 0.1 | 無來源仍生成，有命中才加資料；不是正式中文品質基準 |
| 模型管理 | 核准來源、下載同意、大小／SHA、每跳 HTTPS 白名單、分段續傳、取消／刪除、載入前再校驗 | 不接受任意 URL／路徑／權杖；Gemma 合法散布未配置 |
| 公開資料匯入／更新 | CSV importer、schema／manifest、大小／SHA、原子替換、備份回復、進度／取消 | 營運方可信 HTTPS 發佈主機未配置，UI 明示未啟用 |
| 生命週期 | 自動預熱、共用單一載入、早問排隊與取消、前景模型重用、閒置 90 秒釋放、準備 60 秒／生成 45 秒上限 | 低資源仍可檢索；冷啟動需必要時間，不能保證零延遲；OS OOM 仍可能終止 process |
| 模組化交接 | core ports、native adapter、受限 gateway、獨立 AI 建置宿主、部署與授權文件 | 未推送、未簽章上架、未整併政府 production |

## 驗證

環境：Flutter 3.47.5、Dart 3.13.4、Xcode 27.2、macOS 27、Java 17、Android SDK 36／37。上游 .fvmrc 3.47.6 保留。

| 指令／案例 | 結果 |
|---|---|
| root／core／AI 宿主 flutter analyze | PASS，全部 No issues found |
| root flutter test --reporter expanded | PASS，15 項，含原首頁、bridge 排隊取消／換題、前景重用、閒置／背景、建立／清理失敗與文字 span |
| AI 宿主 flutter test --reporter expanded | PASS，46 項，含自動對話、準備逾時、暫停不保留半成品、空資料、RAG、下載與 Widget |
| node --test microservices/city_ai/test/app.test.cjs | PASS，11 項，含無開啟按鈕、模型載入中送出／停止與一般回答 |
| python3 -m unittest discover -s tools/tests -v | PASS，5 項 |
| python3 spec/scripts/check_spec.py | PASS，3 個明確虛構 fixtures、4 個 query cases |
| 微服務打包／JS syntax | PASS，單一離線 HTML、script/style SHA CSP |
| iOS 自動對話 native | PASS，無開啟操作、三題一般對話、冷啟動排隊、重入同一模型，loads=1；automatic-native-ios.log |
| iOS 有來源完整流程 | PASS，原首頁、RAG、行政區追問、引擎重用、一般對話、設定及 200%／100% 字級；automatic-rag-ios.log |
| Android 自動對話 native | PASS，4 GiB ARM64 API 36 模擬器、正式資源檢查、無開啟操作、排隊及重入模型，loads=1；automatic-native-android.log |
| 正常 Android APK／iOS unsigned | PASS，非 integration test target；APK 大小及 digest 見 artifacts/validation/README.md |
| 本次微服務的真機、讀屏、耗電／溫度／峰值 RAM、正式中文品質基準 | NOT RUN；未安裝至使用者私人 iPhone |

本輪 log 留在 artifacts/validation/automatic-*.log；前輪為 general-*.log，Git 忽略環境／OS 雜訊。截圖由 native integration_test 取得，沒有合成：general-chat-identity.png、general-chat-food.png、townpass-original-home.png、townpass-city-ai-welcome.png、townpass-ai-conversation.png。樣例只證明無來源也能生成；美食回答仍可能包含錯誤店名，不是中文或推薦品質驗收。

前階段 Android／iOS SmolLM2 流程與 Android 飛航測試曾通過，飛航為 airplane=1、wifi=0、data=0、default network=none。這是歷史模擬器證據，不當成新版 IBM 1B 的真機或飛航驗收；既有獨立 PoC 的 iPhone 安裝紀錄也不算本次微服務驗證。

## 模型與預載

IBM 1B 實際檔案 1023645440 bytes；revision b27c2fe3f211b7f44e80fa620177aea371099aaa；SHA-256 22ec0f9cc99a90185312de3c882c84e7bd6789bdd050389844380a01a831d7f1。已從官方 HTTPS 實際下載並核對。模型卡、API／LFS metadata 及其他候選見 docs/local_ai/MODEL_PROVENANCE.md、data/*model_artifact_evidence.json。

Debug 專用 apps/city_ai_demo/lib/main_preload.dart 依使用者預下載要求，透過核准流程準備模型後開啟原首頁；普通 main.dart 已會自動預熱已安裝模型，不需這個下載工具入口。Gemma 維持鎖定。模型證據見 artifacts/validation/model-preload-evidence.json；權重不提交 Git、不包含於 APK。

載入前至少 2 GiB 實體記憶體，可用額度至少 max(512 MiB, 模型檔案大小 + 256 MiB)；生成前再檢查 512 MiB。這是預檢，不是峰值保證。

## 可重現命令

由 repository 根目錄：

    python3 tools/build_city_ai_microservice.py
    flutter pub get
    flutter analyze
    flutter test
    node --test microservices/city_ai/test/app.test.cjs
    python3 -m unittest discover -s tools/tests -v
    cd apps/city_ai_demo
    flutter pub get
    flutter analyze
    flutter test
    flutter run -d <device-id>

原首頁 → 城市小幫手 → 直接送出問題。已安裝模型自動使用；若為新安裝的 App，先在設定同意下載一次。原生測試及建置：

    flutter test integration_test/general_conversation_test.dart -d <device-id>
    flutter test integration_test/townpass_microservice_test.dart -d <device-id> --dart-define=RUN_MODEL_SMOKE=true
    flutter build apk --debug --target-platform android-arm64
    flutter build ios --no-codesign

此 Mac 的 root Flutter 指令使用 XDG_CONFIG_HOME=/Users/cdytim/Desktop/TownPass/tmp/flutter-upstream-config；AI 宿主的 iOS 指令使用 XDG_CONFIG_HOME=/Users/cdytim/Desktop/TownPass/tmp/flutter-config。兩者的 build-dir 放在 Library/Caches，未修改全域設定或關閉 checksum。unsigned iOS 輸出：/Users/cdytim/Library/Caches/TownPassLocalAiBuild/ios/iphoneos/Runner.app。其他環境一般不需 Mac 專用設定，詳見 docs/local_ai/DEPLOYMENT.md。

## 邊界與剩餘限制

- 不使用雲端 LLM、中國團隊 AI 模型、帳戶／定位／健康資料；問題、前文與回答不進入網路請求。對話僅記憶體，重新問／離頁清除。
- 只有固定虛擬 origin、main frame 可操作 bridge；CSP 禁止網頁連線。模型只接受 registry ID，來源只接受已驗證 document ID；文字用 textContent。
- 模型仍可能出錯，無即時店家資料，不保證店名、地址、價格或營業狀態。RAG 結構檢查不是完整語意事實驗證，不能據此判定資格或名額。
- 真實 CSV 為 510 筆、82208 bytes，來源更新 2026-03-04，未冒稱即時；原檔 SHA 與出處見 data/README.md。虛構 fixtures 分開標示。
- 未配置營運方更新主機；無簽章離線匯入、TLS pinning、背景更新或任意歷史版本選擇。
- 原 TownPass 最低 iOS 15.x 不變，AI 宿主為 16.4，Android minSdk 24。只實測 arm64 模擬器，不能推定所有裝置。
- Android AGP 9 的 WebView ProGuard 最小修補在 third_party，保留授權／archive SHA，未修改共用 pub cache。fluttertoast KGP、iOS WebView CocoaPods 仍有工具鏈遷移提示。
- 完整宿主仍有原功能與外掛；AI 隱私聲明不是整份原 App 的權限／封包審查。
- 原 ios/Podfile.lock 開始前已有使用者修改，未還原；原 GPL-3.0／字型聲明保留，新模組 AGPL-3.0-or-later。主辦額外聲明未提供，公開散布仍需補齊與核對授權。

主要程式：lib/features/city_ai、microservices/city_ai、packages/city_ai_core、apps/city_ai_demo；文件 docs/local_ai；資料／工具 data、tools；原 ZIP 保存在 spec。
