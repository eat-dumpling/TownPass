# 離線城市 AI 微服務

城市通 WebView 內的 HTML/CSS/JS 前端，透過 `window.flutterObject.postMessage(JSON.stringify({name,data}))` 呼叫手機原生能力。沒有網頁／後端 LLM，也沒有使用者問題的 HTTP API。

由 repo 根目錄執行 `python3 tools/build_city_ai_microservice.py`，輸出 `assets/microservices/city_ai/index.html` 及本目錄 `dist/index.html`。打包加入 script/style SHA-256 CSP，禁止 connect、frame、form、外部圖片與其他腳本。所有來源／回答用 textContent 呈現，不把模型文字當 HTML 或網址執行。

可用 `python3 -m http.server 8766 --bind 127.0.0.1 --directory microservices/city_ai/dist` 預覽排版；一般瀏覽器沒有手機 bridge，會明確顯示需從城市通開啟，不偽造模型回覆。真正流程用 `apps/city_ai_demo` 啟動原城市通首頁。

橋接僅在 App 隨附頁面的虛擬 origin `https://city-ai.townpass.local`、main frame 開放；這不是下載或政府來源網址，不發送網路 request。網頁任意導覽與敏感權限均拒絕，僅允許最初受控 HTML 載入；官方來源由 native 依已驗證 document ID 開啟。

訊息：`city_ai_state`、`llm_ask`（question / request_id）、`llm_cancel`、`conversation_clear`、`model_enable`、`model_install`、`model_cancel`、`model_delete`、`data_update`、`data_cancel`、`source_open`。未知 action、超長問題、非白名單模型／文件一律拒絕。下載需原生確認，不接受網頁傳入模型 URL、權杖或檔案路徑。

Native state 的 `reply_ready` 區分檢索／生成中與真正完成；網頁在等待期間阻止重複送出，完成或停止後恢復。`text_scale` 由 Flutter TextScaler 取得並隨系統字級更新網頁 rem。來源卡顯示已驗證的官方 URL，開啟時仍只傳 document ID。

前端回歸指令：`node --test microservices/city_ai/test/app.test.cjs`。新版為暖白大字、固定輸入列、原生 dialog 設定；來源節點以內容／引用索引去重更新，降低串流重建與焦點干擾。

所有提問都走同一個對話流程。Native state 的 `answer_mode` 只用來顯示「手機 AI 對話」或「手機 AI・資料參考」，不用來阻擋無來源的提問；只有尚未開啟本機模型時維持純檢索。有來源時顯示 native 來源卡，一般回答明示未連線查證。
