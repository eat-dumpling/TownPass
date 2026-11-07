// 下載 CLIP 影像模型（q8 量化）與物件偵測模型到 public/models/，讓 WebView 離線也能辨識。
// 來源：https://huggingface.co/Xenova/siglip-base-patch16-224（Apache-2.0，Google SigLIP）、https://huggingface.co/Xenova/clip-vit-base-patch32（MIT）
import { mkdirSync, writeFileSync, existsSync } from 'node:fs'
import { dirname } from 'node:path'

// 兩個影像模型都下載（params.json 的 MODEL 決定用哪一個；目前是 SigLIP，CLIP 留著比較用）
for (const MODEL of ['Xenova/siglip-base-patch16-224', 'Xenova/clip-vit-base-patch32']) {
const FILES = ['config.json', 'preprocessor_config.json', 'onnx/vision_model_quantized.onnx']
const out = `public/models/${MODEL}`
for (const f of FILES) {
  const dst = `${out}/${f}`
  if (existsSync(dst)) { console.log('skip', dst); continue }
  const url = `https://huggingface.co/${MODEL}/resolve/main/${f}`
  console.log('GET', url)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${res.status} ${url}`)
  mkdirSync(dirname(dst), { recursive: true })
  writeFileSync(dst, Buffer.from(await res.arrayBuffer()))
}
console.log('done →', out)
}

// 物件偵測（即時框出物品）：MediaPipe EfficientDet-Lite2（主要，較準）與 Lite0（手機太慢時的備案），int8，Apache-2.0
// 模型說明：https://ai.google.dev/edge/mediapipe/solutions/vision/object_detector
for (const name of ['efficientdet_lite2', 'efficientdet_lite0']) {
  const det = `public/models/mediapipe/${name}.tflite`
  if (existsSync(det)) { console.log('skip', det); continue }
  const url = `https://storage.googleapis.com/mediapipe-models/object_detector/${name}/int8/latest/${name}.tflite`
  console.log('GET', url)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${res.status} ${url}`)
  mkdirSync(dirname(det), { recursive: true })
  writeFileSync(det, Buffer.from(await res.arrayBuffer()))
}
console.log('done → public/models/mediapipe/')
