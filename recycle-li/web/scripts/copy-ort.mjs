// 把推論引擎的 wasm 複製到 public/，讓辨識完全離線（不從 CDN 下載）：
// - onnxruntime-web（CLIP）→ public/ort/
// - MediaPipe tasks-vision（物件偵測）→ public/mediapipe/
import { cpSync, mkdirSync, existsSync } from 'node:fs'
const jobs = [
  ['node_modules/@huggingface/transformers/dist', 'public/ort', ['ort-wasm-simd-threaded.jsep.mjs', 'ort-wasm-simd-threaded.jsep.wasm']],
  ['node_modules/@mediapipe/tasks-vision/wasm', 'public/mediapipe', ['vision_wasm_internal.js', 'vision_wasm_internal.wasm', 'vision_wasm_nosimd_internal.js', 'vision_wasm_nosimd_internal.wasm']],
]
for (const [src, dst, files] of jobs) {
  mkdirSync(dst, { recursive: true })
  for (const f of files) {
    if (!existsSync(`${src}/${f}`)) throw new Error(`missing ${src}/${f}`)
    cpSync(`${src}/${f}`, `${dst}/${f}`)
  }
}
console.log('copied wasm → public/ort/, public/mediapipe/')
