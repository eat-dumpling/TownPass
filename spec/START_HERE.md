# TownPass On-Device AI — Codex 一鍵開發規格包

版本：2026-11-06 / 專案定位：**可執行的跨平台 Flutter PoC → 可整合 TownPass 的模組**

本 ZIP 是交給 **Codex 實際撰寫程式碼** 的開發規格，不是已編譯 App，也不是臺北市政府正式版台北通。專案不得使用任何中國模型，所有模型推論必須在手機本機執行。

## 最短使用方式

1. 解壓縮這個 ZIP，開啟 `townpass_codex_spec` 資料夾作為 Codex 工作目錄。
2. Mac 安裝 Flutter / Android SDK；編譯 iOS 需 Xcode。沒有 SDK 的 Codex 環境仍應完成程式碼、測試與清楚的阻礙報告。
3. 在 Codex 貼上下面這段（也可直接讀取 `CODEX_TASK.md`）：

```text
請閱讀本目錄 AGENTS.md、CODEX_TASK.md，以及 docs/ 下所有規格文件，然後直接編寫程式，不要只給我計畫。
請依照 CODEX_TASK.md 的 Definition of Done，實作 apps/city_ai_demo Flutter 專案、離線 RAG、可替換的本機 LLM Adapter、模型管理與下載、測試、開發文件。
你可以執行安裝／測試指令；不允許使用任何中國模型或雲端 LLM API；不要繞過 Google Gemma 授權；不要聲稱未驗證的平台已通過測試。
分階段完成，每個階段都執行能執行的驗證、修正錯誤，最後列出實際修改的檔案、測試結果與仍需真機驗證事項。
```

如果你已經在官方 TownPass fork 中開發，**不要直接套用 standalone 的初始化指令**；改讀 `docs/TOWNPASS_INTEGRATION.md`，先完成架構與版本稽核，再開始整合。

## 文件索引

| 文件 | 用途 |
|---|---|
| `AGENTS.md` | Codex 執行與安全規則 |
| `CODEX_TASK.md` | 唯一主要開發任務單（可直接給 Codex） |
| `docs/PRODUCT_REQUIREMENTS.md` | MVP 功能、使用者體驗與非目標 |
| `docs/ARCHITECTURE.md` | 模組架構、介面與目錄結構 |
| `docs/DATA_RAG_SPEC.md` | 資料格式、匯入、檢索、引用、離線更新 |
| `docs/MODELS_SECURITY.md` | 非中國模型白名單、授權、隱私與安全 |
| `docs/IMPLEMENTATION_PHASES.md` | 實作順序與每階段可測量的交付 |
| `docs/ACCEPTANCE_TESTS.md` | 測試案例、驗收門檻與人工真機檢驗 |
| `docs/TOWNPASS_INTEGRATION.md` | 從獨立 PoC 整合官方 TownPass 的步驟 |
| `docs/SOURCES.md` | 技術事實、已核對的官方來源與不確定性 |
| `fixtures/` | **虛構測試資料**（不得當成市府真實服務） |

## 先避免三個常見錯誤

- **本地端 AI ≠ 全機型都能跑 LLM。** 低階手機要有純檢索模式；不支援原生推論的 OS 仍需評估另行支援。
- **Gemma 3 的官方模型權重有存取條款。** 不提供通用下載 token，不在 app 裡寫入 HF token，不繞過 gate。
- **台北通開源專案 ≠ 能更新市府商店版。** PoC 只能證明可移植性；正式接入需配合市府 API、權限與資安審核。
