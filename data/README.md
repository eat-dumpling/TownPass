# 資料與模型來源證據

官方資料集：[臺北市銀髮族服務_社區照顧關懷據點](https://data.taipei/dataset/detail?id=d082dc87-d3fd-479d-89c6-745ff1be955a)，提供機關：臺北市政府社會局。

本次於 2026-11-06 下載 [CSV](https://data.taipei/api/frontstage/tpeod/dataset/resource.download?rid=11930dc6-4092-4bde-a42c-7722e0416462)。平臺標示檔案更新時間 2026-03-04 11:43:09（臺灣時間）。原檔 `raw/taipei_care_centers.csv`：82,208 bytes，SHA-256 `0d3e50809effbf7a2ee6176b53b5a38482a375f812ba720c8e3eb76fc2e01622`，510 筆。保留原始欄位：據點名稱、據點類型、地址、電話；行政區由地址中明確的臺北市行政區名稱擷取。未推測活動、名額、資格或服務時段。

授權依資料平臺顯示「公開」及其[政府資料開放授權條款連結](https://data.taipei/)；正式散布前仍應保存當時授權頁供營運確認。資料來源日期與 App 建置日期分開。

`model_artifact_evidence.json`、`granite_model_artifact_evidence.json`、`granite_1b_model_artifact_evidence.json` 是 Hugging Face 固定 revision API 實際回傳的精簡紀錄，包含 LFS SHA-256、檔案大小、base_model、license 與 revision。此檔是審查線索；App 內模型白名單與 SHA-256 另有明確鎖定。

`spec/fixtures` 的資料都是虛構；不與官方 seed 混合。原始 CSV 中的組織名稱照原文保留，不代表 AI 模型供應商。
