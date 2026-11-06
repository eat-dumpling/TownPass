# 本機驗證產物

更新 2026-11-06（Asia/Taipei），分支 local-llm-test。完整檔案樹、指令與限制見 [IMPLEMENTATION_STATUS](../../IMPLEMENTATION_STATUS.md)。

| 驗證 | 本輪結果 |
|---|---|
| root／core／AI 宿主分析 | PASS：各 No issues found |
| Flutter 單元／Widget | root 15、AI 宿主 46，合計 61 項 PASS |
| 前端實際 JS 的 DOM／bridge 狀態 | Node 11 項 PASS |
| Python 匯入工具 | 5 項 PASS |
| Android ARM64 API 36 模擬器（本輪 4 GiB） | IBM 1B 實際下載／校驗、無來源的一般本機對話 PASS；先前 2 GiB 的小模型流程另有歷史紀錄 |
| iPhone 18 Pro／iOS 27 模擬器 | 同流程 PASS，含系統字級 200%／100%、模型預載與實際推論 |
| Android Debug APK／iOS unsigned | 皆建置成功；GGUF 不包含於 APK |
| 本次微服務的真機、讀屏、耗電、溫度、正式中文品質基準 | NOT RUN |

[原城市通首頁](townpass-original-home.png) · [大字版初始畫面](townpass-city-ai-welcome.png) · [本機對話](townpass-ai-conversation.png)。截圖由 native integration_test 取得，未合成；平台圖層截圖會受合成時序影響，真機視覺／讀屏仍待驗收。

本輪 `general-*.log` 及 `model-preload-ios.log` 留在本機，Git 忽略完整 log，避免納入 OS／環境雜訊。早期獨立 PoC 的真機安裝資料不算本次微服務驗收。一般對話截圖：[你是誰](general-chat-identity.png)、[台大附近美食](general-chat-food.png)。兩題沒有 RAG 來源仍實際執行模型；畫面內容未經外部查證，不能當成店家或模型品質認證。

模型已在目前 iOS 模擬器私有空間準備完成，大小與 SHA 已核對，見 [model-preload-evidence.json](model-preload-evidence.json)。原首頁 → 城市小幫手 → 直接輸入即可；模型自動預熱，未就緒的問題會保留後回答。模型為 IBM 官方 Granite 4.0 1B Q4_K_M（約 976 MiB），Gemma 鎖定。

前一階段的 Android 飛航核心測試 PASS：下載校驗後設 airplane=1、wifi=0、data=0、default network=none，再執行檢索、CPU 生成、取消、重用與刪除。該案例與 WebView 流程分開測試，本輪沒有冒稱重新執行真機飛航。

本輪正常入口 APK（ARM64 Debug，非 integration test target）：

- 路徑：`apps/city_ai_demo/build/app/outputs/flutter-apk/app-debug.apk`
- 大小：307078759 bytes
- SHA-256：`1aa5442678860972a93a5092ac068a7ae71b8f25bcec65411bcf0d4a75599069`

正式公開資料更新主機未配置；模型與資料服務不會接收使用者問題。

本輪 automatic-*.log：Android／iOS 皆輸出 AUTOMATIC_CHAT_NATIVE passed=true、manual_enable=false、loads=1、reentry_reused=true、early_queue_observed=true。三個一般問題沒有使用開啟按鈕；iOS RAG／追問／大字另見 automatic-rag-ios.log。這是模擬器功能測試，不是零延遲或最新活動／店家資訊認證。
