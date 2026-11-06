# 城市通微服務整合與指引對照

已讀取 ZIP 全部 AGENTS、CODEX_TASK 與 docs，以及使用者補充的《2026 城市通入門指引》65 頁。文件是開發參考，不是發佈、登入、推送或存取私人資料的授權。

## 目前的實際架構

```text
原城市通首頁／服務清單
  └─「城市小幫手」入口 → CityAiMicroservicePage
       └─ App 隨附 HTML/CSS/JS 微服務（WebView）
            └─ flutterObject.postMessage({name,data})
                 └─ 受限 CityAiGateway（固定 origin、main frame、長度與 action 檢查）
                      └─ city_ai_core / CityAiController
                           ├─ 離線詞彙 RAG／來源卡／資料更新
                           └─ LocalInferenceEngine
                                └─ llamadart → 私有 GGUF → 手機 CPU
```

原首頁、底部分頁及原 routing 保留，只新增入口與 route。`microservices/city_ai` 是網頁來源，打包為 `assets/microservices/city_ai/index.html`；不是用新的 Flutter 聊天首頁取代城市通。共用 `packages/city_ai_core` 沒有原生模型相依，既有 App 可保留純檢索。

AI 宿主 `apps/city_ai_demo` 的 main 直接呼叫原 TownPass services／MyApp，再註冊本機 Adapter。宿主採 iOS 16.4；原 repo 的最低 iOS 15.x 不變。兩個入口使用同一首頁與同一微服務；原入口未連結 native runtime，所以明示純檢索，AI 宿主能實際下載並載入本機模型。

## 對照入門指引

| 指引 | 已實作 |
|---|---|
| p9-15 環境、repo、建置 | 原 repo feature branch；記錄實際 Flutter/Dart/AGP/Gradle；保留 build_runner 產生流程 |
| p24-27 服務註冊 | MyServiceItemId.localAi、服務清單、熱門、首頁入口；`townpass://city-ai` 導向本機 WebView route |
| p29 色彩與字級 | 網頁使用 #5AB4C5、#F5BA4B／高對比深色；系統字體與可放大 rem；宿主沿用原 TownPass 字型與 UI |
| p30 無障礙 | 56px 控制、明確 labels、live status、plain text；Flutter TextScaler 傳入 WebView，隨系統字級更新 rem；Widget 200% 字級／tap target 與 native WebView 字級／水平溢出測試；真機讀屏待測 |
| p40 開放資料 | 真實下載社會局 CSV 510 筆；原檔 digest／來源日期保留；虛構 fixtures 分開 |
| p49-50 裝置端 AI／Handler | WebView → `llm_ask` → native CPU；引擎一次載入重用、串流、取消、前文上限、行政區追問 |
| p51 以官方版本授權為準 | 依實際 llamadart 0.17.5 / companion 0.17.3 API；Gemma 依法鎖定，不沿用 PDF 舊版 API |
| p61 交接與揭露 | 原 GPL 聲明、新模組 AGPL、資料／模型／套件表、可重現命令；主辦額外指定聲明未提供，未假造 |

## Bridge 與資料邊界

只有隨附文件的虛擬 origin `https://city-ai.townpass.local`、main frame 能操作 native gateway。僅允許最初受控 HTML 載入；其他網頁導覽、popup 與敏感權限都拒絕。這個虛擬 origin 不會進行 HTTP 請求。沒有把 LLM handler 加入既有 wildcard 遠端網頁 listener。

CSP 以實際 script/style SHA-256 限制程式，connect/frame/form/img 均為 none。所有回答、來源與使用者文字由 textContent 呈現。模型下載只能傳 registry ID，來源開啟只能傳已知 document ID；不接受任意 URL、檔案路徑、使用者權杖或 HTML。原生下載對話框要求明確同意。

模型前文只在記憶體保存最近最多 3 組；context tokenizer 再將最舊前文移除至預算內。新對話／離頁清除 controller 前文與畫面；AI 宿主共用前景模型，回首頁保溫最多 90 秒，背景／低記憶體釋放。每次 create 明確傳入當次前文，不帶入前頁對話；原生緩衝不宣稱安全抹除。依使用者最新指示，所有問題都是一般本機對話，RAG 有命中才參考；沒有來源不阻擋推論。已移除限定引文 grammar，來源核對不是完整語意事實驗證。

## 相容性處理

- Android AGP 9.1.0 拒絕舊 WebView plugin 的非 optimize ProGuard 檔。保留授權 vendor `flutter_inappwebview_android 1.1.3`，只修該設定，詳見 third_party 的 TOWNPASS_PATCH.md。
- iOS WebView 仍由 CocoaPods 連結，llama runtime 由 SwiftPM companion 提供，兩者可共同建置；不是宣稱全部既有 plugin 已完成 SPM 遷移。
- 根專案原先分析警告已做機械性清理；TPTextSpan 改由 superclass 保留分字後 spans，新增中英混合文字回歸測試。原首頁內容與導覽未重寫。
- 這是使用者 fork 的實作，不代表已整併官方 production 台北通，未取得任何政府私人 API／上架權限。

當次畫面的對話可留在 WebView 記憶體，直到「重新問」或離頁；未寫入磁碟。公開資料成功更新會清除舊對話與引用，失敗／取消則保留。模型失敗、載入、停止與釋放採串列操作，並以整次生成 45 秒限制回退。

使用者最新指示優先於 ZIP 原本「沒有來源就拒答」的要求。低階或未開啟模型的裝置仍維持純檢索；一般對話與 RAG 由同一個 `LocalInferenceEngine.generate` 處理，不需使用者選擇模式。

使用者亦明確要求自動本機對話，優先於 ZIP 原本每次手動啟用的互動。首頁首幀後預熱、單一準備 Future、排隊問題與可取消狀態由 core/session/gateway 管理；網頁不自行傳 model_enable 開啟。準備最多 60 秒，逾時或缺模型保留檢索，不自動下載。完整 SHA 在 isolate 執行，不以刪除校驗換取速度。一般原入口仍是純檢索，只有 AI 宿主註冊此 session。
