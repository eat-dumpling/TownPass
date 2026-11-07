// 在電腦上批次測試 CLIP 辨識準確率（和手機用同一個 q8 影像模型與 text_embeds.json）。
// 用法：node scripts/eval-photos.mjs [照片資料夾，預設 ../testdata/photos] [--md]
// 檔名開頭是正確的品項 id。輸出：第一名、前三名、臺北類別（孩子的桶）正確率與認錯清單。
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { AutoImageProcessor, CLIPVisionModelWithProjection, RawImage, env } from '@huggingface/transformers'
import { loadClassWeights, loadProtos } from './proto-codec.mjs'
import { MODELS } from './models.mjs'
import * as TF from '@huggingface/transformers'

const args = process.argv.slice(2)
const md = args.includes('--md')
const dir = resolve(args.find((a) => !a.startsWith('--')) ?? '../testdata/photos')
const PARAMS = JSON.parse(readFileSync('src/vision/params.json', 'utf8'))
const MM = MODELS[PARAMS.MODEL ?? 'clip']
const MODEL = MM.id
// 和手機相同的參數與範例向量（scripts/tune.mjs 調好的 src/vision/params.json）
const { TEMPERATURE, PROTO_ALPHA, PROTO_BETA, CLASS_WEIGHTS } = JSON.parse(readFileSync('src/vision/params.json', 'utf8'))

const files = readdirSync(dir).filter((f) => /\.(jpe?g|png|webp|heic)$/i.test(f)).sort()
if (!files.length) { console.error(`${dir} 裡沒有照片，請先依 README 放測試照`); process.exit(1) }

env.allowRemoteModels = false
env.localModelPath = resolve('public/models') + '/'
const items = JSON.parse(readFileSync('src/data/items.json', 'utf8'))
const embeds = JSON.parse(readFileSync('public/data/text_embeds.json', 'utf8'))
const protos = existsSync('public/data/image_protos.json') ? loadProtos('public/data/image_protos.json') : {}
// 和手機相同：有學到的分類向量就取代文字向量
if (CLASS_WEIGHTS && existsSync('public/data/class_weights.json')) Object.assign(embeds.items, loadClassWeights('public/data/class_weights.json'))
const processor = await AutoImageProcessor.from_pretrained(MODEL)
const model = await TF[MM.vision].from_pretrained(MODEL, { dtype: 'q8' })

const norm = (v) => { let s = 0; for (const x of v) s += x * x; const n = Math.sqrt(s) || 1; return Array.from(v, (x) => x / n) }
const ids = items.map((i) => i.id).sort((a, b) => b.length - a.length)
const byId = Object.fromEntries(items.map((i) => [i.id, i]))

const rows = []
for (const f of files) {
  const expected = ids.find((id) => f.toLowerCase().startsWith(id))
  const t0 = performance.now()
  const image = await RawImage.read(join(dir, f))
  const v = norm((await model(await processor(image)))[MM.visionOut].data)
  const all = [...Object.entries(embeds.items), ...Object.entries(embeds.negatives ?? {})].map(([id, t]) => {
    const cos = (a) => { let d = 0; for (let k = 0; k < v.length; k++) d += v[k] * a[k]; return d }
    let logit = cos(t) * TEMPERATURE
    for (const pv of protos[id] ?? []) logit += PROTO_ALPHA * Math.exp(-PROTO_BETA * (1 - cos(pv)))
    return { id, logit }
  })
  const mx = Math.max(...all.map((a) => a.logit))
  const z = all.reduce((s, a) => s + Math.exp(a.logit - mx), 0)
  const ranked = all.map((a) => ({ id: a.id, p: Math.exp(a.logit - mx) / z })).sort((a, b) => b.p - a.p)
  const top = ranked.filter((r) => !r.id.startsWith('_neg_')).slice(0, 3)
  rows.push({ f, expected, top, neg: ranked[0].id.startsWith('_neg_') ? ranked[0].id : null, ms: performance.now() - t0 })
}

const L = rows.filter((r) => r.expected)
const pct = (n) => (L.length ? Math.round((n / L.length) * 100) : 0)
const top1 = L.filter((r) => r.top[0].id === r.expected).length
const top3 = L.filter((r) => r.top.some((t) => t.id === r.expected)).length
const kind = L.filter((r) => byId[r.top[0].id]?.kind === byId[r.expected]?.kind).length
const ms = Math.round(rows.reduce((s, r) => s + r.ms, 0) / rows.length)

const out = []
out.push(`| 張數 | 第一名 | 前三名 | 分到對的桶 | 平均時間（電腦 CPU） |`, `|---|---|---|---|---|`,
  `| ${L.length} | ${pct(top1)}% | ${pct(top3)}% | ${pct(kind)}% | ${ms} ms |`, '')
const wrong = L.filter((r) => r.top[0].id !== r.expected)
if (wrong.length) {
  out.push('認錯的：', '')
  for (const r of wrong) out.push(`- ${r.f}：猜 ${r.top.map((t) => `${t.id} ${Math.round(t.p * 100)}%`).join('、')}${r.neg ? `（背景類別 ${r.neg} 最高）` : ''}`)
}
if (!md) for (const r of rows) console.error(`${!r.expected ? '-- ' : r.top[0].id === r.expected ? 'OK ' : 'NG '} ${r.f} → ${r.top[0].id} ${Math.round(r.top[0].p * 100)}%`)
console.log(out.join('\n'))
