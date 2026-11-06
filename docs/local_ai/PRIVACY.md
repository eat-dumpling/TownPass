# 隱私與資料邊界

AI 微服務不要求登入、定位、相機、麥克風、通訊錄、健康或追蹤權限，也不取得城市通帳戶。問題、檢索 context、前文與模型輸出只在記憶體，不存對話、不使用 analytics／crash upload／雲端 LLM。llamadart 與該 WebView 的除錯記錄均關閉，避免訊息進入 plugin log。

完整宿主沿用既有城市通外掛與其他功能，不能把此段聲明解讀成整個原 App 的所有功能或 merged manifest 都只有 INTERNET。AI 宿主啟動時關閉原 App 自動通知詢問；其他城市通功能的既有能力不由 AI 微服務呼叫。原 App 初始 mock 帳戶與 banners 保留，未假裝是真實市民資料或市政即時內容。

只有使用者明確同意下載模型、按公開資料更新、或點官方來源，才由 AI 功能發送公開檔案 GET／外部瀏覽。問題、回覆與前文不加入 URL、標頭或 body。網頁 CSP 禁止連線，推論 Adapter 只讀私有路徑；沒有任何網頁或遠端推論 API。

模型與更新資料在 Application Support。Android AI 宿主關閉備份；iOS 下載前將 Application Support 排除備份。模型刪除先停止並釋放引擎，再刪權重／暫存。刪 App 依 OS 清除私有檔，不宣稱安全抹除。

iOS App privacy manifest 為磁碟空間預檢宣告 E174.1、私有檔案 timestamp API 宣告 C617.1；runtime／既有 plugin 各自 manifest 仍需隨最終 binary 檢查。理由依 [Apple required reason API 文件](https://developer.apple.com/documentation/bundleresources/app-privacy-configuration/nsprivacyaccessedapitypes/nsprivacyaccessedapitypereasons)；未聲稱通過 App Store Connect 審查。

低 RAM、載入失敗、取消、App 進背景等情況均保留純檢索。OS 原生 OOM 可能直接終止 process，不能保證被 Dart 捕捉。真機封包與完整 app log 鑑識、讀屏、耗電、溫度仍未執行；已完成的模擬器飛航與 native 對話結果見 IMPLEMENTATION_STATUS。

使用者明確要求預下載後，開發專用 main_preload.dart 可先以核准安裝流程準備 IBM Granite 模型再開原首頁；僅 Debug，沒有 Gemma 或權杖路徑。普通 main.dart 在首頁背景預熱已安裝模型。資料更新取消、離頁或背景會中止公開資料傳輸；失敗的 native 清理不阻塞檢索。

一般聊天與有來源的回答都由同一個本機引擎處理；無來源不會觸發雲端請求。一般回答明示「未連線查證」。對話不會決定下載 URL、模型、更新主機或任何外部動作。

依使用者最新要求，本機對話預設自動使用已安裝模型，不需額外開啟；下載仍須同意。前景共用模型，離頁取消等待／生成、清除 controller 前文與 WebView。原生引擎緩衝可能保留至釋放，不承諾安全抹除；不將前頁訊息傳給下一次 create、不寫磁碟。背景、記憶體壓力或首頁閒置 90 秒釋放，回前景自動恢復；省電選擇在本次 App session 內保留。
