# 2026 城市通微服務大黑客松：回收小里長＋丟丟 TossTalk

本 repo 是台北通（TownPass）的 fork，加上兩個微服務作品。原本的台北通說明在本頁下方（「What is Town Pass?」）。

| 作品 | 給誰 | 做什麼 | 程式 | 說明 |
|---|---|---|---|---|
| **回收小里長** | 孩童 | 掃一掃或選物品 → 學會怎麼分類、拖進正確的桶 → 拿星星、蓋自己的里 | `recycle-li/web/`（Vue 3＋Vite） | [recycle-li/README.md](recycle-li/README.md) |
| **丟丟 TossTalk** | 外籍人士、外籍學生、新住民 | 這個怎麼丟、今天能不能丟、垃圾車幾點到、哪裡可以丟、收藏停靠點並提醒（8 種語言） | `microservices/trash_helper/`（純 HTML/JS，隨 App 內建，可離線） | [microservices/trash_helper/README.md](microservices/trash_helper/README.md) |

`trash-helper/` 是丟丟較早的 Vue 原型，App 沒有使用，留作參考。

## 在台北通裡的入口

- 服務 › 我的服務：**丟丟**（`lib/page/city_service/model/my_service_model.dart`）、**回收小里長**
- 服務 › 熱門：回收小里長、丟丟（`lib/page/city_service/model/trending_service_model.dart`）
- 網址設定：`lib/util/tp_microservice_config.dart`（`RECYCLE_LI_URL`）、`lib/util/trash_helper.dart`（`TRASH_HELPER_URL`，預設用 App 內建的頁面）

## 建置

```bash
# 台北通（Flutter 3.47.6，見 .fvmrc）
fvm install
fvm flutter pub get
fvm dart run build_runner build --delete-conflicting-outputs
fvm flutter run                                                # 丟丟用 App 內建頁面
fvm flutter run --dart-define=RECYCLE_LI_URL=http://<區網 IP>:5173/   # 回收小里長連開發機

# 回收小里長（微服務）
cd recycle-li/web && npm install && npm run fetch:model && npm run dev
npm run build && firebase deploy --only hosting                # 部署到 Firebase Hosting

# 丟丟（微服務）
python3 microservices/trash_helper/server.py                   # 開發用，http://127.0.0.1:8788/
```

詳細步驟、測試指令與實機測試方式見兩個作品各自的 README。

## 台北通（App 端）的修改

| 位置 | 修改 |
|---|---|
| `lib/page/city_service/model/` | 新增兩個服務入口與熱門按鈕 |
| `lib/util/web_message_handler/` | 新增橋接：`trash_favorites`、`trash_reminder_save`／`_cancel`／`_test`、`trash_listen`（丟丟），`schedule_notify`、`cancel_notify`（排程通知） |
| `lib/page/trash_helper/` | 丟丟的內建頁面伺服器（127.0.0.1）、收藏與本機通知排程、語音輸入 |
| `lib/util/tp_web_view.dart` | iOS 點擊延遲與返回鍵修正、只對白名單微服務開放相機 |
| `ios/`、`android/` | 相機、相簿、麥克風、語音辨識用途說明；本機 http 只允許 127.0.0.1；通知排程 receiver |

## 新增的第三方套件（App 端）

| 套件 | 授權 | 用途 |
|---|---|---|
| `speech_to_text` | BSD-3-Clause | 丟丟語音助理（使用手機內建的語音辨識） |
| `permission_handler` | MIT | Android 相機、麥克風權限 |
| `timezone` | BSD-2-Clause | 收運提醒以臺北時間排程 |

微服務使用的套件與授權列在各自的 README（回收小里長「套件」表、丟丟「授權」段）。

## 資料來源

核心資料都是合法開放資料並註明出處，主要是臺北市政府環境保護局在 data.taipei 的資料集：資源回收分類方式、垃圾車點位路線資訊、限時收受點、專用垃圾袋代售點、舊衣回收設施據點，以及衛生局廢棄藥物檢收站。地圖與部分地點使用 OpenStreetMap（© OpenStreetMap contributors，ODbL）。完整清單、版本與模擬資料標示見兩個作品的 README「資料來源」。

## AI 使用揭露

- **執行時**：只有影像辨識模型，在手機的 WebView 內推論，不呼叫雲端 API，不使用生成式 AI。
  - Google SigLIP base patch16 224（`Xenova/siglip-base-patch16-224`），q8 量化 ONNX，Transformers.js／ONNX Runtime Web（WASM），Apache-2.0。
  - MediaPipe Object Detector EfficientDet-Lite0／Lite2，int8 TFLite，@mediapipe/tasks-vision，Apache-2.0。
  - 細節（版本、雜湊、準確率）見 [recycle-li/README.md](recycle-li/README.md)「AI 與模型揭露」。
- **語音輸入**（丟丟）：使用手機作業系統內建的語音辨識（iOS Speech、Android SpeechRecognizer），只在使用者按下麥克風後聆聽。
- **開發階段**：使用 Claude Code、Codex 協助撰寫程式、文件與翻譯；開發時用影像生成產生的插圖記錄在回收小里長 README「插圖來源」。

## 授權

- 兩個微服務作品：**AGPL-3.0**，全文見 `recycle-li/LICENSE`、`microservices/trash_helper/LICENSE`。
- 台北通本身：GPL-3.0（根目錄 `LICENSE`）。
- 主辦指定的授權聲明：**待補**（依競賽須知 115.08.27 版）。

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
