# 生圖清單（開發階段用 Codex CLI 產生，執行時不生成任何圖片）

`assets.csv` 每行一個檔名、尺寸與主體描述。每張都加上風格提示詞：

```text
Flat vector illustration for children, thick rounded outlines, soft pastel colors,
friendly cute face, centered single subject, transparent background, no text, no logos.
```

流程：批次生成 → 去背、縮放、轉 WebP → 人工檢查（風格一致、沒有文字、不像真實品牌）→ 放到 `web/public/assets/` →
在 README 記錄工具、模型與人工審核方式。Codex CLI 實際的生圖指令與額度依你們安裝的版本確認。
