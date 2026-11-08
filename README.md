# 丟丟TossTalk：垃圾怎麼丟都看得懂

![丟丟TossTalk：垃圾怎麼丟都看得懂。看不懂垃圾分類？掃一下就能懂怎麼丟，以 8 種語言與注音，一步步教外籍人士、兒童照臺北規則丟垃圾。主題：看不懂。對象：外籍人士・新住民、兒童、數位素養不足者。方向：多語服務、易讀設計、圖像化指引、分齡介面。右邊是三張 iPhone 實機截圖。](docs/readme/overview.png)

2026 臺北秋季程式設計節・城市通微服務大黑客松作品。本 repo 是台北通（TownPass）的 fork，在台北通裡加了一個服務「丟丟」，丟丟首頁的「兒童模式」切到回收小里長；原本的台北通說明在本頁最下方。

## 專案簡介 / Project Overview

**主題：看不懂 #理解限制**

> **垃圾怎麼丟，拍一下、用你的語言、一步一步告訴你。**
>
> 一套臺北市官方垃圾規則，兩種讀法：**丟丟 TossTalk** 給大人（外籍人士、新住民、長輩）；丟丟首頁右上角的「兒童模式」切到**回收小里長**，同一套規則加上注音，給孩子用。

臺北的垃圾規則寫得很清楚：一般垃圾要用專用袋、週三週日停收、平面和立體回收分不同天、垃圾不落地。問題是，**看得懂這些規則的前提是會讀中文、看得懂分類名詞、會操作層層選單**。我們把同一套官方規則，做成不用讀懂也能照著做的服務。

### 我們解決誰的痛點 / Whose Problem We Solve

| 對象 | 卡在哪裡 | 我們怎麼做 | 對應方向 |
|---|---|---|---|
| **外籍人士・新住民** | 規則和母國不同，資訊幾乎只有中文；不知道垃圾車幾點、在哪裡等，也看不懂「立體類」「平面類」 | **丟丟**：8 種語言；用母語說話或打字問；「今天要丟什麼」勾一勾，一次一步帶著做；垃圾車停靠點地圖與到站前提醒 | 多語服務、易讀設計 |
| **兒童** | 分類名詞抽象、字多，大人也常說不清楚為什麼 | **兒童模式（回收小里長）**：每個國字都有注音；拍一拍認出東西，照三個圖示步驟做，拖進正確顏色的桶，拿星星；再用「考考你」複習 | 分齡介面、圖像化指引 |
| **數位素養不足者**（長輩等） | 介面字小、步驟多、要打字搜尋，怕按錯 | 丟丟和兒童模式都是一頁一件事、大按鈕（≥ 48dp）、圖示配短句；拍照或說話就能問，不用打字；收運提醒自動排好 | 易讀設計、圖像化指引 |

分類答案一律來自臺北市環保局的官方規則表，模型只負責「認出是什麼東西」，不會自己編答案。

## 功能說明 / Features

| | 兒童模式：回收小里長（給兒童） | 丟丟 TossTalk（給外籍人士、新住民、長輩） |
|---|---|---|
| 認東西 | 掃一掃（相機即時辨識）或從圖卡選 | 拍照、說話、打字或從清單選 |
| 怎麼丟 | 告訴你是哪一類，把它拖進對的桶 | 每個步驟一張圖卡：要不要專用袋、怎麼處理、交給哪台車 |
| 什麼時候丟 | — | 今天收什麼、垃圾車幾點到、附近停靠點與限時收受點地圖 |
| 記得做 | 考考你、分辨卡（底部選單只有家、掃一掃、圖鑑） | 收藏停靠點，垃圾車到前通知 |
| 語言 | 繁體中文＋注音 | 繁中、英、越、印、菲、泰、韓、日 |

在台北通的入口只有一個：**服務 › 我的服務 › 丟丟**（熱門也有）。丟丟首頁右上角「兒童模式」切到回收小里長，回收小里長右上角的箭頭回到丟丟。兩者都隨 App 內建，從手機本身提供頁面，沒有網路也能開（斷網時丟丟的地圖改成停靠點清單）；丟丟線上版：<https://taipei-trash-helper.web.app>。

## 系統架構 / System Architecture

```mermaid
flowchart LR
  subgraph App[台北通 App（Flutter）]
    WV[WebView] <-- flutterObject 雙向溝通 --> H[自訂 Handler：收藏、提醒、語音、通知]
    LS[內建頁面伺服器 127.0.0.1] --> WV
  end
  LS --> DD[丟丟<br>HTML／JS＋Leaflet]
  DD -- 兒童模式 --> RL[回收小里長<br>Vue 3＋Vite]
  RL & DD --> M[裝置端辨識<br>SigLIP＋MediaPipe（WASM）]
  RL & DD --> R[官方規則表與開放資料<br>環保局 data.taipei]
```

| 位置 | 內容 |
|---|---|
| `recycle-li/web/` | 回收小里長（Vue 3、Vite、TypeScript），說明見 [recycle-li/README.md](recycle-li/README.md) |
| `microservices/trash_helper/` | 丟丟（純 HTML／JS、Leaflet），說明見 [microservices/trash_helper/README.md](microservices/trash_helper/README.md) |
| `lib/page/trash_helper/` | 內建頁面伺服器（丟丟 127.0.0.1:8790、回收小里長 :8791，開丟丟時兩個一起啟動）、收藏與本機通知排程、語音輸入 |
| `lib/util/web_message_handler/` | 新增橋接：`trash_favorites`、`trash_reminder_save`／`_cancel`／`_test`、`trash_listen`、`schedule_notify`、`cancel_notify` |
| `lib/util/tp_web_view.dart` | iOS 點擊延遲與返回鍵修正、只對自己的服務開放相機 |

## 安裝與執行 / Installation & Run

```bash
# 台北通（Flutter 3.47.6，見 .fvmrc）
fvm install
fvm flutter pub get
fvm dart run build_runner build --delete-conflicting-outputs
zsh tools/trash_helper_vision/build.sh                          # 1. 先下載辨識模型與 wasm（約 110 MB，不進 git）建進丟丟
zsh tools/recycle_li_bundle/build.sh                            # 2. 再把回收小里長建置進 App（和丟丟共用同一份模型）
fvm flutter run

# 開發時改連自己電腦上的版本
fvm flutter run --dart-define=RECYCLE_LI_URL=http://<區網 IP>:5173/ --dart-define=TRASH_HELPER_URL=http://<區網 IP>:8788/

# 回收小里長
cd recycle-li/web && npm install && npm run fetch:model && npm run dev

# 丟丟
python3 microservices/trash_helper/server.py                    # http://127.0.0.1:8788/

# 部署（Firebase Hosting）
cd recycle-li/web && npm run build && firebase deploy --only hosting --project recycle-li
cd microservices/trash_helper && firebase deploy --only hosting --project taipei-trash-helper
```

實機測試、測試指令見兩個作品各自的 README。

## 資料來源 / Data Sources

核心資料都是合法開放資料，主要來自臺北市政府環境保護局（data.taipei）：資源回收分類方式、垃圾車點位路線資訊、限時收受點、專用垃圾袋代售點、舊衣回收設施據點，以及衛生局廢棄藥物檢收站。地圖使用 OpenStreetMap（© OpenStreetMap contributors，ODbL）。完整清單、版本與模擬資料標示見兩個作品的 README。

## 分類規則怎麼核對 / How the Rules Are Checked

答案只來自規則表 `recycle-li/web/src/data/items.json`（107 條），每條都有 `source`。`recycle-li/scripts/verify_items.py` 把每條和官方資料逐條比對：

1. 品項名稱出現在環保局「回收一點通」的品名裡，而且那幾筆的大類全部和我們一致（65 條）；
2. 否則看 data.taipei「資源回收分類方式」：品項名稱列在同一子類的說明欄，且回收一點通沒有相反說法（19 條）。

對上的 84 條標 `verified`，並在 `verified_by` 記下是第幾筆；3 條官方說法不一致的標 `conflict`，畫面上說「請洽清潔隊」；其餘 20 條（例如剩菜剩飯、紙便當盒）官方沒有逐項列出或說法不同，**App 內建版不顯示**。

## 上線後的維運 / Operations After Handover

| 問題 | 做法 |
|---|---|
| 資料誰更新 | 垃圾車點位、代售點、限時收受點用 data.taipei 開放資料，重跑抓取腳本即可更新（見丟丟 README）；分類規則表建議由環保局資源回收科每季核對 `status`，改完重跑 `verify_items.py` |
| 跟現有服務重不重複 | 資料和環保局「回收一點通」、垃圾車即時動態同源，我們是它們的**多語、圖像、兒童前端**：拍照或說母語就能問、一次一步帶著做、孩子用注音學 |
| 辨識錯了怎麼辦 | 模型只負責認出是什麼東西，答案永遠查規則表；沒把握就不回答，改成讓使用者從圖卡選 |
| 成本 | 不需要伺服器：頁面和模型隨 App 內建，從手機本機提供；沒有雲端 AI 費用 |
| 個資 | 不用帳號；相機畫面不上傳、不存檔；位置用完即丟，只存停靠點編號與里名 |

## 第三方套件 / Third-party Packages（App 端新增）

| 套件 | 授權 | 用途 |
|---|---|---|
| `speech_to_text` | BSD-3-Clause | 丟丟的語音提問（手機內建語音辨識） |
| `permission_handler` | MIT | Android 相機、麥克風權限 |
| `timezone` | BSD-2-Clause | 收運提醒以臺北時間排程 |

微服務用到的套件與授權列在各自的 README。

## AI 使用聲明 / AI Usage Declaration

- **執行時**：只有影像辨識模型，在手機的 WebView 內推論，不呼叫雲端 API，不使用生成式 AI。
  - Google SigLIP base patch16 224（`Xenova/siglip-base-patch16-224`），q8 量化 ONNX，Transformers.js／ONNX Runtime Web（WASM），Apache-2.0
  - MediaPipe Object Detector EfficientDet-Lite0，int8 TFLite，@mediapipe/tasks-vision，Apache-2.0（App 內建這一個；Lite2 只在開發用的辨識測試室比較）
  - 開發時曾和 OpenAI CLIP ViT-B/32 比較準確率，正式版不使用、不打包
  - 版本、雜湊與準確率見 [recycle-li/README.md](recycle-li/README.md)「AI 與模型揭露」
- **語音提問**（丟丟）：使用手機作業系統內建的語音辨識，只在按下麥克風後聆聽。
- **開發輔助**：Claude Code、Codex 協助撰寫程式、文件與翻譯；回收小里長「我的里」插圖在開發時以影像生成產生，記錄在其 README「插圖來源」。
- **本頁主圖**：`docs/readme/overview.html` 排版；三張都是 iPhone 實機截圖（掃描畫面背景已模糊），沒有使用生成圖片。

## 授權 / License

- 兩個微服務：**AGPL-3.0**（`recycle-li/LICENSE`、`microservices/trash_helper/LICENSE`）
- 台北通本身：GPL-3.0（根目錄 `LICENSE`）

依競賽須知第捌條「智慧財產聲明」，授權聲明如下（也放在兩個微服務 `LICENSE` 的開頭）：

```
回收小里長＋丟丟 TossTalk — 2026 臺北秋季程式設計節「城市通微服務大黑客松」參賽作品，以台北通（TownPass）為基礎的垃圾分類與垃圾生活微服務。
Copyright (C) 2026 我們早餐吃水餃
This program is free software: you can redistribute it and/or modify it under the terms of the GNU Affero General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.
This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU Affero General Public License for more details.
You should have received a copy of the GNU Affero General Public License along with this program. If not, see <https://www.gnu.org/licenses/>.
```

依競賽規則：

- 主辦單位及所屬機關得依照 AGPL 條款規範使用本作品。
- 本作品授權維持 AGPL-3.0，且自得獎公布起 1 年內不擅自下架。
- 本作品沒有侵害他人智慧財產權或違反法令的情事。
- 若獲獎，授權主辦單位使用參賽成果，並配合與城市通開源程式碼整合。

---

# What is Town Pass?

Town Pass is an open-source project developed by the Taipei City Government. With the growth of smart cities, the demand for digitalization in city management and citizen services continues to rise. As we enter a new digital era, our goal is to involve citizens in the process, combining third-party expertise and innovation to make digital life in Taipei more convenient.

Town Pass is not just an application; it is an open community project. Through open-source, every citizen can participate in the ideation, development, and optimization of the application. This not only enhances citizen engagement and satisfaction but also leverages collective intelligence to continuously improve the application, making it truly serve the people. Furthermore, we hope that various municipalities can widely adopt the open-source framework of Town Pass, integrate it with their existing municipal service systems, and quickly have their own applications to enhance digital governance.

Open source is a key driver of technological progress and social development. Through open-source, Town Pass will become an ever-evolving platform, attracting developers from all backgrounds to contribute. We welcome experts to submit code, report issues, provide suggestions, and even develop new features and creative ideas, working together to perfect Town Pass as we advance toward a smart city.

# Getting Started

We highly recommend to read through our [document](https://tpe-guideline.web.app/en/docs/) for more detail.

Here are some quick setup guide.

## Requirement

- [Flutter](https://docs.flutter.dev/get-started/install) or [FVM](https://fvm.app/documentation/getting-started/installation)
- [XCode](https://developer.apple.com/xcode/) (for iOS)
- [Android SDK](https://developer.android.com/studio/index.html) (for Android, with or without Android Studio)

## Build the Project

1. Get the packages project needed:

   ``` bash
   flutter pub get
   ```

2. Generate additional needed dart code for the project.

   ``` bash
   dart run build_runner build
   ```

3. You are all set now, Run the project from your IDE or the through the command line:

   ``` bash
   flutter run
   ```
