// 從 recycle-li 複製共用的辨識資源到本 App 的 public/（不進 git）：
// CLIP 模型、物件偵測模型、onnxruntime 與 MediaPipe 的 wasm、文字向量與範例向量。
// recycle-li 那邊先跑過 `npm run fetch:model` 與 `npm run build:embeds`。
import { cpSync, existsSync, mkdirSync, statSync } from 'node:fs'
import { dirname } from 'node:path'

const R = '../../recycle-li/web'
const jobs = [
  [`${R}/public/models`, 'public/models'],
  [`${R}/node_modules/@huggingface/transformers/dist/ort-wasm-simd-threaded.jsep.mjs`, 'public/ort/ort-wasm-simd-threaded.jsep.mjs'],
  [`${R}/node_modules/@huggingface/transformers/dist/ort-wasm-simd-threaded.jsep.wasm`, 'public/ort/ort-wasm-simd-threaded.jsep.wasm'],
  ...['vision_wasm_internal.js', 'vision_wasm_internal.wasm', 'vision_wasm_nosimd_internal.js', 'vision_wasm_nosimd_internal.wasm']
    .map((f) => [`${R}/node_modules/@mediapipe/tasks-vision/wasm/${f}`, `public/mediapipe/${f}`]),
  [`${R}/public/data/text_embeds.json`, 'public/data/text_embeds.json'],
  [`${R}/public/data/image_protos.json`, 'public/data/image_protos.json', true],
]
for (const [src, dst, optional] of jobs) {
  if (!existsSync(src)) { if (optional) continue; throw new Error(`缺少 ${src}（先在 recycle-li/web 跑 npm install、npm run fetch:model）`) }
  const same = existsSync(dst) && !statSync(src).isDirectory() && statSync(src).size === statSync(dst).size && statSync(src).mtimeMs <= statSync(dst).mtimeMs
  if (same) continue
  mkdirSync(dirname(dst), { recursive: true })
  cpSync(src, dst, { recursive: true, force: true })
}
console.log('copied shared models, wasm and embeddings')
