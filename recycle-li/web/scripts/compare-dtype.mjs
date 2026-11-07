// 比較同一個影像模型的兩種量化（預設 q8 vs q4f16）：影像向量差多少、答案一不一樣、準確率有沒有掉。
// 用驗證照片（../testdata/hand，manifest 有正確品項）。評分和手機一樣（學過的分類向量＋範例向量＋溫度；不含偵測器先驗）。
// 用法：node scripts/compare-dtype.mjs [--a q8] [--b q4f16] [--limit 160]
// 要比的模型檔先下載到 public/models/<模型>/onnx/（例：vision_model_q4f16.onnx），比完刪掉，不要放進建置。
// 結果（2026-11-07，SigLIP，286 張驗證照片）：q8 品項對 79.0%；q4 76.6%；q4f16 約掉 3 個百分點 → 用 q8
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import * as TF from '@huggingface/transformers'
import { AutoImageProcessor, env, RawImage } from '@huggingface/transformers'
import { MODELS } from './models.mjs'
import { loadClassWeights, loadProtos } from './proto-codec.mjs'

const args = process.argv.slice(2)
const arg = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d)
const A = arg('--a', 'q8'), B = arg('--b', 'q4f16'), LIMIT = Number(arg('--limit', 1e9))
const PARAMS = JSON.parse(readFileSync('src/vision/params.json', 'utf8'))
const MM = MODELS[PARAMS.MODEL ?? 'clip']
env.allowRemoteModels = false
env.localModelPath = resolve('public/models') + '/'
const items = JSON.parse(readFileSync('src/data/items.json', 'utf8'))
const byId = Object.fromEntries(items.map((i) => [i.id, i]))
const embeds = JSON.parse(readFileSync('public/data/text_embeds.json', 'utf8'))
if (PARAMS.CLASS_WEIGHTS && existsSync('public/data/class_weights.json')) Object.assign(embeds.items, loadClassWeights('public/data/class_weights.json'))
const protos = existsSync('public/data/image_protos.json') ? loadProtos('public/data/image_protos.json') : {}
const HAND = resolve('../testdata/hand')
const manifest = JSON.parse(readFileSync(join(HAND, 'manifest.json'), 'utf8')).slice(0, LIMIT)

const processor = await AutoImageProcessor.from_pretrained(MM.id)
const ma = await TF[MM.vision].from_pretrained(MM.id, { dtype: A })
const mb = await TF[MM.vision].from_pretrained(MM.id, { dtype: B })
const norm = (v) => { let s = 0; for (const x of v) s += x * x; const n = Math.sqrt(s) || 1; return Array.from(v, (x) => x / n) }
const dot = (a, b) => { let d = 0; for (let k = 0; k < a.length; k++) d += a[k] * b[k]; return d }
function top1(v) {
  let best = null, bl = -Infinity
  for (const [id, t] of Object.entries(embeds.items)) {
    let l = dot(v, t) * PARAMS.TEMPERATURE
    for (const pv of protos[id] ?? []) l += PARAMS.PROTO_ALPHA * Math.exp(-PARAMS.PROTO_BETA * (1 - dot(v, pv)))
    if (l > bl) { bl = l; best = id }
  }
  return best
}

let n = 0, same = 0, okA = 0, okB = 0, kindA = 0, kindB = 0, cosSum = 0, cosMin = 1, msA = 0, msB = 0
for (const m of manifest) {
  const inputs = await processor(await RawImage.read(join(HAND, m.file)))
  let t0 = performance.now()
  const va = norm((await ma(inputs))[MM.visionOut].data); msA += performance.now() - t0
  t0 = performance.now()
  const vb = norm((await mb(inputs))[MM.visionOut].data); msB += performance.now() - t0
  const c = dot(va, vb)
  const ta = top1(va), tb = top1(vb)
  n++; cosSum += c; cosMin = Math.min(cosMin, c); same += ta === tb
  okA += ta === m.item; okB += tb === m.item
  kindA += byId[ta]?.kind === byId[m.item]?.kind; kindB += byId[tb]?.kind === byId[m.item]?.kind
}
const pct = (x) => `${((x / n) * 100).toFixed(1)}%`
console.log(`${n} 張驗證照片（整張照片，不裁切）`)
console.log(`影像向量 cosine：平均 ${(cosSum / n).toFixed(4)}、最低 ${cosMin.toFixed(4)}`)
console.log(`第一名一樣：${pct(same)}`)
console.log(`${A}：品項對 ${pct(okA)}、桶子對 ${pct(kindA)}、${(msA / n).toFixed(0)} ms／張（Node CPU）`)
console.log(`${B}：品項對 ${pct(okB)}、桶子對 ${pct(kindB)}、${(msB / n).toFixed(0)} ms／張（Node CPU）`)
