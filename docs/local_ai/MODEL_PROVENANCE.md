# 模型與 runtime 來源紀錄

審查日期：2026-11-06。只接受程式中固定的來源、revision、檔案大小與 SHA-256；沒有任意模型 URL、雲端推論、embedding、ASR、TTS 或中國模型 fallback。

| 用途 | 原始開發者與模型 | Artifact／授權 |
|---|---|---|
| 一般對話建議模型 | [IBM Granite 4.0 1B](https://huggingface.co/ibm-granite/granite-4.0-1b) | [IBM 官方 GGUF](https://huggingface.co/ibm-granite/granite-4.0-1b-GGUF)，Apache-2.0，ungated |
| 較小測試候選 | [IBM Granite 4.0 350M](https://huggingface.co/ibm-granite/granite-4.0-350m) | [IBM 官方 GGUF](https://huggingface.co/ibm-granite/granite-4.0-350m-GGUF)，Apache-2.0，ungated |
| 最小 runtime 煙霧測試 | [Hugging Face SmolLM2-135M-Instruct](https://huggingface.co/HuggingFaceTB/SmolLM2-135M-Instruct) | [Unsloth AI GGUF](https://huggingface.co/unsloth/SmolLM2-135M-Instruct-GGUF)，Apache-2.0 |
| 鎖定，未下載 | [Google Gemma 3 1B IT QAT Q4_0](https://huggingface.co/google/gemma-3-1b-it-qat-q4_0-gguf) | 官方要求同意條款；合法散布未配置，pending / disabled，無 URL／hash／權杖路徑 |

IBM 模型卡列明 Granite Team, IBM，支援中文與其他語言；1B 版本的實際參數約 1.6B，350M 的中文表現較弱，不能只憑「模型能執行」推定可用品質。GGUF 由 IBM 官方帳號發布，模型卡指向原始權重；轉換流程為 [IBM/gguf](https://github.com/IBM/gguf)。這是來源審查，不是逐位元供應鏈重建認證。

## 固定檔案

| 模型 ID | revision | bytes | SHA-256 |
|---|---|---:|---|
| granite-4-1b-q4km | b27c2fe3f211b7f44e80fa620177aea371099aaa | 1023645440 | 22ec0f9cc99a90185312de3c882c84e7bd6789bdd050389844380a01a831d7f1 |
| granite-4-350m-q4km | b8208a86a58427e1739265318028eb5895b74bf2 | 236985760 | 771c588a49607f274a2bba3185733607ebe6f74b996ab90e2d6bee0d98bcec52 |
| smollm2-135m-q4km | 9e6855bc4be717fca1ef21360a1db4b29d5c559a | 105454144 | ed5fa30c487b282ec156c29062f1222e5c20875a944ac98289dbd242e947f747 |

官方固定 revision API／LFS metadata 分別保存在 data/granite_1b_model_artifact_evidence.json、data/granite_model_artifact_evidence.json、data/model_artifact_evidence.json。權重不提交 Git、不包含於 App。

下載只允許每一跳白名單 HTTPS 主機，傳輸中斷可在同一工作內從下一個位元組續傳，206 Content-Range 必須精確一致；重試次數與總時間有上限。完整檔案的預期大小與 SHA 仍須通過，才原子安裝。取消會清除暫存，不跨 App 重啟保留未驗證權重。每次載入前再驗證，已載入引擎跨問題重用。

## 對話與限制

依使用者最新要求，所有問題都是一般本機對話；RAG 有命中才補參考資料。沒有資料也能生成，已移除舊的有限引文 GBNF。一般回答明示「未連線查證」。來源資料以不可信文字傳入，來源卡與開啟網址始終由 native 已驗證 document ID 決定。引用範圍、外部網址、明顯注入與部分結構化事實有防護，但不是完整語意事實驗證；不能保證模型不犯錯或以模型判斷市政資格。

runtime：[llamadart 0.17.5](https://pub.dev/packages/llamadart/versions/0.17.5) + llamadart_llama_cpp_flutter 0.17.3；CPU、4096 context、384 maxTokens、temperature 0.1、2 threads、關閉 thinking／native 內容 log。前文最多取最近 2 組，再依 tokenizer 裁至 3200 預算。Apple companion 固定 leehack/llamadart-native@v0.8.0-1 與 binary checksum，未停用校驗；未聲稱 GPU／NPU 加速。

載入前檢查至少 2 GiB 實體記憶體及 max(512 MiB, 模型檔案大小 + 256 MiB) 可用額度；生成前再檢查 512 MiB。iOS 模擬器實測 host free/inactive pages，真機檢查 process 可用額度；Android 使用 ActivityManager。這只是保守預檢，不是峰值 RAM 保證，資源不足仍可純檢索。

實際驗證與預載證據見 IMPLEMENTATION_STATUS.md 與 artifacts/validation/model-preload-evidence.json；模擬器結果不是實體手機或中文品質基準。Gemma 保持鎖定，不能只改 enabled 旗標繞過白名單與授權審查。

最新互動：AI 宿主首頁背景預熱已安裝模型，無開啟按鈕。冷啟動問題可排隊，SHA 在獨立 isolate 執行；前景重入沿用載入結果，不每題 reload。這不省略校驗，不代表尚未下載也可執行；下載仍經同意。離頁後前景最多保溫 90 秒，App 背景或記憶體壓力釋放。
