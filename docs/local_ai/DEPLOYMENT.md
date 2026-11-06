# 建置、資料維運與真機驗收

## 標準工具鏈

Flutter / Dart 見 `IMPLEMENTATION_STATUS.md`；Android SDK 及 Java 17、Xcode 及 Swift Package Manager。由 `apps/city_ai_demo` 執行 README 指令。`pubspec.lock` 鎖定 App 解析結果。Android debug 簽章僅供開發；release 須自行設 keystore。iOS unsigned Runner.app 是編譯證據，不能視為可安裝的正式簽章 App。

## 此 Mac 的建置路徑修復

全域 `/Users/cdytim/.config/flutter/settings` 原本含 `build-dir=../../../Library/Caches/EmployaFlutterBuild`，在不同深度專案會指向不同甚至不可寫路徑。本次沒有更改該檔案。Desktop 下輸出遇到 `resource fork, Finder information, or similar detritus not allowed`，使用獨立 config 將 iOS 輸出移到使用者 Library/Caches。

在 repository 根目錄建立只供本機、已被忽略的設定：

```sh
mkdir -p tmp/flutter-config
python3 - <<'PY'
from pathlib import Path
import json
settings = {
  'build-dir': '../../../../Library/Caches/TownPassLocalAiBuild',
  'android-sdk': str(Path.home() / 'Library/Android/sdk'),
}
Path('tmp/flutter-config/settings').write_text(json.dumps(settings))
PY
cd apps/city_ai_demo
XDG_CONFIG_HOME="$PWD/../../tmp/flutter-config" flutter build ios --no-codesign
```

相對路徑以本 App 在 repo 的深度為準。標準環境可採預設 `build`，不需要上述設定。此修復沒有關閉 checksum、授權、ATS 或其他完整性檢查。

## 在這台 Mac 上安裝到 iPhone

以下保留既有獨立 PoC 的安裝紀錄與操作說明；它不是本次「原城市通首頁 → 微服務」版本的真機驗證。本次版本僅完成 Android／iOS 模擬器與 unsigned iOS 建置，完整真機驗收仍待執行。

在 Xcode 的 Settings → Apple Accounts 登入自己的 Apple Account，使用 Personal Team 即可進行開發測試。iPhone 須信任這台 Mac 並開啟開發者模式。這台 Mac 已建立開發憑證；2026-11-06 已將 City AI Demo 1.0.0+1 的 Release 版本簽章並安裝至使用者指定的 iPhone 11（iOS 27.2）。簽章驗證通過，provisioning profile 包含該手機。使用者已完成開發者信任；`devicectl` 啟動成功，並透過 Device Hub 確認真機顯示主畫面及 510 筆內建資料。

沿用上方本機 build-dir 設定，從 repository 根目錄執行：

```sh
flutter devices
cd apps/city_ai_demo
XDG_CONFIG_HOME="$PWD/../../tmp/flutter-config" flutter run --release -d <iphone-device-id>
```

第一次若出現未信任開發者，開啟 iPhone「設定 → 一般 → VPN 與裝置管理」，在「開發者 App」選擇自己的 Apple Account 並信任，依手機提示完成後再次啟動（[Flutter 官方說明](https://docs.flutter.dev/platform-integration/ios/setup#prepare-the-device)）。Release 版本啟動後可拔除傳輸線，從主畫面開啟「離線城市助理 PoC」。個人團隊的開發安裝有有效期限，到期後需連線重新建置與安裝；此次 profile 到期時間為 2026-11-13 01:29（Asia/Taipei）。

裝置安裝與啟動結果見本機 `artifacts/validation/iphone11-*.json`；簽章建置記錄見 `artifacts/validation/iphone11-sign-build.log`。這些驗證產物含裝置識別資訊，供本機交接使用。

## 公開資料更新交接

匯入工具不連網，只讀指定 UTF-8/BOM CSV。來源下載與授權記錄由操作者保存。每次更新先確認欄位、資料集描述與來源日期，再以 `--built-at` 固定建置時間獲得可重現 JSON。測試資料務必 `--demo`，不與正式資料混合。發佈時把 snapshot 放到 immutable 路徑，最後原子更新受控 HTTPS manifest。App 最大 snapshot 10 MiB／10000 筆，錯誤版本、空資料、重複 ID、不同 dataset、非官方 source URL 或 hash 不符均拒絕。

只有已審查的確切主機可以出現在 `KNOWLEDGE_RELEASE_HOST`。兩個 dart-define 是營運方的 release 設定，不可由聊天文字、來源文件或模型生成。此版採受控 TLS manifest，未實作簽章更新包、離線檔案挑選或回復到任意歷史版本；已安裝快取自動保留上一個已驗證版本。

## 真機測試表（尚待執行）

| 項目 | 記錄要求 |
|---|---|
| 裝置 | 型號、OS、RAM、App commit、模型 revision / SHA-256 |
| 飛航 | 有資料無模型、裝好模型兩種狀態；Wi-Fi/行動資料皆關，重新啟動後查詢 |
| 模型生命周期 | 同意下載、取消、重試、載入一次重用、停止、刪除、重新下載 |
| 資源 | 低 RAM、低磁碟、iOS memory warning、背景/前景；應清楚回退，不呼叫雲端 |
| 無障礙 | TalkBack、VoiceOver、200% 系統字體、鍵盤焦點、所有 48dp targets |
| 品質 | 20 題繁體中文，分直接／同義／資料不足／即時資格各 5 題；人工標示 grounded / incorrect / hallucinated / abstained |
| 效能 | 首 token、tokens/s、峰值 RAM、電量、溫度；必須實測，不能由模擬器推定 |
| 隱私 | 代理／封包記錄與 app log；只出現 opt-in 檔案 GET 與使用者主動官方來源瀏覽，沒有 query/answer 上傳 |

模擬器自動測試及先前 PoC 的真機安裝不等於本次微服務的真機飛航、讀屏、耗電或中文品質驗證。完整驗收仍依上述測試表逐項進行。
