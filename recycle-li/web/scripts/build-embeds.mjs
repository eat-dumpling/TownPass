// 建置時算好每個品項的 CLIP 文字向量，輸出 public/data/text_embeds.json。手機上只跑影像模型。
//
// 做法（CLIP 論文的 prompt ensembling）：每個品項的每句描述 × 每個拍照情境模板 → 文字向量 → 正規化後平均。
// 另外加入「不是垃圾」的背景類別（_neg_*），掃到人臉、空手、房間時不會硬猜成某個品項。
// 第一次執行會從 Hugging Face 下載文字模型到 node 快取（只在開發機；授權 MIT）。
// SPEC 原本寫 build_embeds.py；改用 Transformers.js，讓文字與影像用同一份權重、同一套前處理。
import { readFileSync, writeFileSync } from 'node:fs'
import * as T from '@huggingface/transformers'
import { pickModel } from './models.mjs'

const M = pickModel() // --model clip 或 siglip（預設：params.json 的 MODEL）
const MODEL = M.id
const args = process.argv.slice(2)
const arg = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d)
const OUT = arg('--out', 'public/data/text_embeds.json')
// 模板組合（用 scripts/tune.mjs --embeds 比較；預設 home）
const VARIANTS = {
  home: [
    'a photo of {}.', 'a close-up photo of {}.', 'a photo of {} on a table.', 'a photo of {} held in a hand.',
    'a blurry photo of {}.', 'a photo of {} in a kitchen.',
  ],
  // 加上「當垃圾丟掉」的情境（TACO 多是地上的垃圾）
  trash: [
    'a photo of {}.', 'a close-up photo of {}.', 'a photo of {} on a table.', 'a photo of {} held in a hand.',
    'a blurry photo of {}.', 'a photo of {} in a kitchen.', 'a photo of {} thrown away as trash.', 'a photo of a used {} on the ground.',
  ],
  plain: ['a photo of {}.'],
}
const VARIANT = arg('--variant', 'home')
export const TEMPLATES = VARIANTS[VARIANT]
if (!TEMPLATES) throw new Error(`unknown --variant ${VARIANT}`)
export const NEGATIVES = {
  _neg_face: ['a person\'s face', 'a selfie of a child'],
  _neg_hand: ['an empty hand', 'a hand with nothing in it'],
  _neg_room: ['an empty room', 'a living room', 'a blank wall', 'a floor'],
  _neg_pet: ['a cat', 'a dog'],
  _neg_plant: ['a potted plant', 'a tree outside'],
  _neg_table: ['an empty table top', 'a wooden desk surface'],
  _neg_body: ['a person\'s arm', 'a person\'s shoulder'],
}

const items = JSON.parse(readFileSync('src/data/items.json', 'utf8'))
const tokenizer = await T.AutoTokenizer.from_pretrained(MODEL)
const model = await T[M.text].from_pretrained(MODEL, { dtype: 'fp32' })

const norm = (v) => { let s = 0; for (const x of v) s += x * x; const n = Math.sqrt(s) || 1; return v.map((x) => x / n) }

async function embed(descriptions) {
  const texts = descriptions.flatMap((d) => TEMPLATES.map((t) => t.replace('{}', d)))
  const inputs = tokenizer(texts, M.textPad)
  const text_embeds = (await model(inputs))[M.textOut]
  const [n, d] = text_embeds.dims
  const avg = new Array(d).fill(0)
  for (let i = 0; i < n; i++) {
    const row = norm(Array.from(text_embeds.data.slice(i * d, (i + 1) * d)))
    for (let k = 0; k < d; k++) avg[k] += row[k] / n
  }
  return { vec: norm(avg).map((x) => +x.toFixed(5)), count: texts.length }
}

const out = { model: MODEL, arch: M.name, dtype: 'fp32', dim: M.dim, variant: VARIANT, templates: TEMPLATES, items: {}, negatives: {} }
for (const it of items) {
  const { vec, count } = await embed(it.prompts)
  out.items[it.id] = vec
  console.log(it.id, count)
}
for (const [id, ds] of Object.entries(NEGATIVES)) {
  out.negatives[id] = (await embed(ds)).vec
  console.log(id)
}
writeFileSync(OUT, JSON.stringify(out))
console.log(`wrote ${OUT} (${items.length} items, ${Object.keys(NEGATIVES).length} negatives)`)
