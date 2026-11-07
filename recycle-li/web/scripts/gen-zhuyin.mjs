// 產生注音字表 src/zhuyin/chars.json：只收 App 畫面會用到的字。
// 讀音以臺灣標準為準：全字庫（CNS 11643）字音資料列出每個字的臺灣讀音；
// pinyin-pro（MIT，只在建置時用）只用來在多音字裡挑預設讀音，挑出的讀音一定要在全字庫的讀音裡。
// 詞語層級的讀音（垃圾、里長、東西…）寫在 src/zhuyin/words.ts，由人工審過。
//
// 用法（先下載全字庫開放資料 Properties.zip 與 MapingTables.zip 並解壓）：
//   node scripts/gen-zhuyin.mjs <CNS_phonetic.txt> <CNS2UNICODE 對照表目錄> [--review]
// 資料來源：數位發展部，CNS11643中文標準交換碼全字庫網站，https://www.cns11643.gov.tw（政府資料開放授權條款第 1 版）
import fs from 'node:fs'
import path from 'node:path'
import { pinyin } from 'pinyin-pro'
import { pinyinToZhuyin } from '../src/zhuyin/convert.ts'
import { CHAR_FIX, WORDS } from '../src/zhuyin/words.ts'

const [phoneticFile, uniDir] = process.argv.slice(2)
const review = process.argv.includes('--review')
if (!phoneticFile || !uniDir) {
  console.error('usage: node scripts/gen-zhuyin.mjs <CNS_phonetic.txt> <unicode-dir> [--review]')
  process.exit(1)
}

// CNS 碼 → 字
const cns2ch = new Map()
for (const f of fs.readdirSync(uniDir)) {
  for (const line of fs.readFileSync(path.join(uniDir, f), 'utf8').split(/\r?\n/)) {
    const [cns, hex] = line.split('\t')
    if (cns && hex) cns2ch.set(cns.trim(), String.fromCodePoint(parseInt(hex.trim(), 16)))
  }
}
// 字 → 臺灣讀音（全字庫順序）
const tw = new Map()
for (const line of fs.readFileSync(phoneticFile, 'utf8').split(/\r?\n/)) {
  const [cns, zy] = line.split('\t')
  const ch = cns2ch.get(cns?.trim())
  if (!ch || !zy) continue
  const list = tw.get(ch) ?? []
  const z = zy.trim()
  if (!list.includes(z)) list.push(z)
  tw.set(ch, list)
}

// App 用到的字（含資料檔；paused 不建置所以不收）
const files = []
;(function walk(d) {
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f)
    if (p.includes('paused') || p.includes(`zhuyin${path.sep}chars.json`)) continue
    if (fs.statSync(p).isDirectory()) walk(p)
    else if (/\.(vue|ts|json)$/.test(f) && !/\.(test|gen)\.ts$/.test(f)) files.push(p)
  }
})('src')
const chars = new Set()
const runs = new Map() // 連續的中文字串，給 --review 看上下文
for (const f of files) {
  const text = fs.readFileSync(f, 'utf8')
  for (const c of text) if (/\p{Script=Han}/u.test(c)) chars.add(c)
  for (const m of text.matchAll(/\p{Script=Han}+/gu)) runs.set(m[0], (runs.get(m[0]) ?? 0) + 1)
}

const out = {}
const missing = []
const flagged = []
const poly = new Map()
for (const c of [...chars].sort()) {
  const readings = tw.get(c)
  if (!readings?.length) { missing.push(c); continue }
  const guess = pinyinToZhuyin(pinyin(c, { toneType: 'num', type: 'array' })[0] ?? '')
  const def = readings.includes(guess) ? guess : readings[0]
  if (!readings.includes(guess)) flagged.push(`${c} pinyin-pro=${guess} 全字庫=${readings.join('/')}`)
  out[c] = def
  if (readings.length > 1) poly.set(c, [def, ...readings.filter((r) => r !== def)])
}
// 人工校正一定要是全字庫有的讀音
let bad = 0
// 詞裡的輕聲（東西的西）全字庫不會列，只要去掉聲調後的音節對得上就算對
const bare = (z) => z.replace(/[˙ˊˇˋ]/g, '')
const ok = (c, z) => tw.get(c)?.includes(z) || (z.startsWith('˙') && tw.get(c)?.some((r) => bare(r) === bare(z)))
const check = (c, z, where) => { if (!ok(c, z)) { bad++; console.error(`  ${where}：「${c}」${z} 不在全字庫（${tw.get(c)?.join('/') ?? '無'}）`) } }
for (const [c, z] of Object.entries(CHAR_FIX)) check(c, z, 'CHAR_FIX')
for (const [w, zs] of Object.entries(WORDS)) { const a = zs.split(' '); if (a.length !== [...w].length) { bad++; console.error(`  WORDS：${w} 字數不合`) } ;[...w].forEach((c, i) => check(c, a[i], `WORDS ${w}`)) }
if (bad) { console.error(`words.ts 有 ${bad} 個讀音要修`); process.exitCode = 1 }
fs.mkdirSync('src/zhuyin', { recursive: true })
fs.writeFileSync('src/zhuyin/chars.json', JSON.stringify(out, null, 0).replace(/","/g, '",\n"') + '\n')
console.log(`chars.json: ${Object.keys(out).length} 字；全字庫沒有讀音 ${missing.length}：${missing.join('')}`)

if (review) {
  console.log(`\n預設讀音不在全字庫裡（改用全字庫第一個）：${flagged.length}`)
  for (const f of flagged) console.log('  ' + f)
  console.log('\n多音字與出現的詞（審 words.ts 用）：')
  for (const [c, rs] of poly) {
    const ctx = [...runs.keys()].filter((r) => r.includes(c) && r.length > 1).slice(0, 8)
    if (ctx.length) console.log(`  ${c} [${rs.join('/')}] ${ctx.join('、')}`)
  }
}
