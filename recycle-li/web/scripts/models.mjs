import { readFileSync } from 'node:fs'
// 可選的影像–文字模型（都在裝置端用 Transformers.js 推論；授權與來源寫在 README「AI 與模型揭露」）。
// clip：OpenAI CLIP ViT-B/32（MIT）；siglip：Google SigLIP base patch16 224（Apache-2.0）。
export const MODELS = {
  clip: {
    id: 'Xenova/clip-vit-base-patch32', dim: 512,
    vision: 'CLIPVisionModelWithProjection', visionOut: 'image_embeds',
    text: 'CLIPTextModelWithProjection', textOut: 'text_embeds', textPad: { padding: true, truncation: true },
  },
  siglip: {
    id: 'Xenova/siglip-base-patch16-224', dim: 768,
    vision: 'SiglipVisionModel', visionOut: 'pooler_output',
    // SigLIP 訓練時文字都補到 64 個 token，推論也要一樣
    text: 'SiglipTextModel', textOut: 'pooler_output', textPad: { padding: 'max_length', max_length: 64, truncation: true },
  },
}
// 沒指定 --model 時用 App 正在用的模型（src/vision/params.json 的 MODEL），避免重建文字向量時維度和 App 對不上
export function activeModel() {
  try { return JSON.parse(readFileSync(new URL('../src/vision/params.json', import.meta.url), 'utf8')).MODEL ?? 'clip' } catch { return 'clip' }
}
export function pickModel(argv = process.argv) {
  const name = argv.includes('--model') ? argv[argv.indexOf('--model') + 1] : activeModel()
  const m = MODELS[name]
  if (!m) throw new Error(`unknown --model ${name}`)
  return { name, ...m }
}
