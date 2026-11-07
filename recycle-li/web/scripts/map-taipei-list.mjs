// 把「回收一點通」1,031 筆（臺北市環保局，data/回收一點通_1031筆.tsv）的每一種東西對到 items.json 的品項，
// 用來（1）補訓練照片的搜尋詞（例：木椅、藤椅 → 桌椅；冷凍櫃 → 電冰箱），讓模型看過同一個品項的各種樣子；
//     （2）列出「規則表裡沒有對應品項」的東西（要新增品項時參考，不會自動改 items.json）。
// 做法：取出每筆的英文名稱，用 SigLIP 文字模型算向量，和品項的文字向量（public/data/text_embeds.json）比 cosine；
// 只在「大類相同」的品項裡比（一般垃圾只對一般垃圾、立體類只對立體類…），分數太低的算沒有對應。
// 輸出 data/taipei_list_mapping.csv。用法：node scripts/map-taipei-list.mjs
import { readFileSync, writeFileSync } from 'node:fs'
import * as T from '@huggingface/transformers'
import { pickModel } from './models.mjs'

const M = pickModel()
const MIN_COS = 0.6 // 低於這個值算「沒有對應的品項」（看過分數分佈後定的）
const rows = readFileSync('../data/回收一點通_1031筆.tsv', 'utf8').split('\n').filter(Boolean).map((l) => l.split('\t'))
const items = JSON.parse(readFileSync('src/data/items.json', 'utf8'))
const emb = JSON.parse(readFileSync('public/data/text_embeds.json', 'utf8'))

// 回收一點通的大類 → items.json 的 category（同一個大類才比）
const CAT = [
  [/一般垃圾/, ['general', 'unknown', 'special']],
  [/立體類/, ['recycle_3d']],
  [/平面類/, ['recycle_flat']],
  [/約定時間|巨大/, ['bulky']],
  [/其他類/, ['other', 'food', 'special']],
]
const catsOf = (big, desc) => {
  if (/廚餘|堆肥|Compost/i.test(desc)) return ['food', 'other']
  for (const [re, cats] of CAT) if (re.test(big)) return cats
  return null
}

// 名稱：第 4 欄（類別-名稱(English)、名稱(English)）沒有時用第 7 欄（「髒塑膠袋，屬一般垃圾…」）
function namesOf(r) {
  const sub = r[3] && r[3] !== '無' ? r[3].replace(/^[^-]*-/, '') : ''
  const text = sub || r[6] || ''
  const en = [...text.matchAll(/\(\s*([A-Za-z][^()（）]*?)\s*\)/g)].map((m) => m[1].replace(/\s+/g, ' ').trim()).filter((s) => s.length > 2 && !/^(e\.g\.|etc)/i.test(s))
  const zh = (sub || (r[6] || '').split(/[，,。]|為|屬/)[0]).replace(/\([^)]*\)/g, '').replace(/[A-Za-z]/g, '').replace(/\s+/g, '').slice(0, 40)
  return { zh, en: [...new Set(en)].slice(0, 4) }
}

const tokenizer = await T.AutoTokenizer.from_pretrained(M.id)
const model = await T[M.text].from_pretrained(M.id, { dtype: 'fp32' })
const norm = (v) => { let s = 0; for (const x of v) s += x * x; const n = Math.sqrt(s) || 1; return v.map((x) => x / n) }
async function embed(text) {
  const out = (await model(tokenizer([`a photo of ${text}.`], M.textPad)))[M.textOut]
  return norm(Array.from(out.data))
}
const dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0)

const out = [['row', 'name_zh', 'name_en', 'taipei_category', 'item', 'item_zh', 'cos', 'status']]
let mapped = 0, none = 0
for (let i = 1; i < rows.length; i++) {
  const r = rows[i]
  const { zh, en } = namesOf(r)
  const cats = catsOf(r[2] ?? '', r.join(' '))
  if (!en.length || !cats) { out.push([i, zh, en.join('; '), r[2], '', '', '', 'skip']); continue }
  const v = norm((await Promise.all(en.map(embed))).reduce((a, b) => a.map((x, k) => x + b[k])))
  let best = null, bestC = -1
  for (const it of items) {
    if (!cats.includes(it.category)) continue
    const w = emb.items[it.id]
    if (!w) continue
    const c = dot(v, w)
    if (c > bestC) { bestC = c; best = it }
  }
  const ok = best && bestC >= MIN_COS
  ok ? mapped++ : none++
  out.push([i, zh, en.join('; '), r[2], ok ? best.id : '', ok ? best.name.zh : (best ? `（最接近：${best.name.zh}）` : ''), bestC.toFixed(3), ok ? 'mapped' : 'no_item'])
  if (i % 100 === 0) console.log(`${i}/${rows.length - 1}`)
}
const esc = (s) => `"${String(s ?? '').replace(/"/g, '""')}"`
writeFileSync('../data/taipei_list_mapping.csv', out.map((r) => r.map(esc).join(',')).join('\n') + '\n')
console.log(`對到品項 ${mapped}、沒有對應 ${none}、略過（沒有英文名稱或大類）${rows.length - 1 - mapped - none} → data/taipei_list_mapping.csv`)
