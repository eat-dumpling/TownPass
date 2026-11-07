// 用真實照片調 CLIP 的評分參數、產生範例向量（和手機用同一個 q8 影像模型與 text_embeds.json）。
//
// 資料：TACO 裁切（../testdata/taco/crops.json，CC BY 4.0）＋ Wikimedia Commons 照片（../testdata/web/manifest.json）
// 切分：依「來源照片」雜湊固定切成 約 60% 訓練／40% 測試（同一張照片的多個框不會跨組）。所有數字都只看測試組。
// 指標：品項第一名、前三名（第一名在可接受品項內才算對）、分到對的桶（孩子的桶 kind）、被判成「不是垃圾」的比例。
// 輸出：src/vision/params.json（調好的參數）、public/data/image_protos.json（訓練組的範例向量，int8 壓縮）、
//       ../testdata/cache/tune-report.md（報告）
//
// 用法：node scripts/tune.mjs [--no-write]
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import * as TF from '@huggingface/transformers'
import { pickModel } from './models.mjs'
const { AutoImageProcessor, RawImage, env } = TF
import { encodeProto } from './proto-codec.mjs'

const NO_WRITE = process.argv.includes('--no-write') || (process.argv.includes('--model') && !process.argv.includes('--write'))
const EMBEDS = process.argv.includes('--embeds') ? process.argv[process.argv.indexOf('--embeds') + 1] : 'public/data/text_embeds.json'
const TD = resolve('../testdata')
const CACHE = join(TD, 'cache')
mkdirSync(CACHE, { recursive: true })
const M = pickModel() // --model clip 或 siglip（預設：params.json 的 MODEL）
const MODEL = M.id

const items = JSON.parse(readFileSync('src/data/items.json', 'utf8'))
const byId = Object.fromEntries(items.map((i) => [i.id, i]))
const embeds = JSON.parse(readFileSync(EMBEDS, 'utf8'))
const itemIds = items.map((i) => i.id).filter((id) => embeds.items[id])
const textMat = itemIds.map((id) => embeds.items[id])
const negIds = Object.keys(embeds.negatives ?? {})
const negMat = negIds.map((id) => embeds.negatives[id])

// ── 資料集 ─────────────────────────────────────────────
const samples = []
const tacoFile = join(TD, 'taco/crops.json')
if (existsSync(tacoFile)) {
  for (const c of JSON.parse(readFileSync(tacoFile, 'utf8'))) {
    samples.push({ src: 'taco', path: join(TD, 'taco', c.file), group: `taco:${c.image}`, accept: c.accept.filter((a) => byId[a]), label: c.taco })
  }
}
const webFile = join(TD, 'web/manifest.json')
if (existsSync(webFile)) {
  for (const m of JSON.parse(readFileSync(webFile, 'utf8'))) {
    if (!byId[m.item]) continue
    samples.push({ src: 'web', path: join(TD, 'web', m.file), group: `web:${m.title}`, accept: [m.item], label: m.item })
  }
}
const isTest = (g) => createHash('sha1').update(g).digest()[0] % 10 < 4

// ── 影像向量（快取） ──────────────────────────────────────
const vecFile = join(CACHE, M.name === 'clip' ? 'vectors.json' : `vectors_${M.name}.json`)
const vecCache = existsSync(vecFile) ? JSON.parse(readFileSync(vecFile, 'utf8')) : {}
const norm = (v) => { let s = 0; for (const x of v) s += x * x; const n = Math.sqrt(s) || 1; return Array.from(v, (x) => x / n) }
const missing = samples.filter((s) => !vecCache[s.path])
if (missing.length) {
  env.allowRemoteModels = false
  env.localModelPath = resolve('public/models') + '/'
  const processor = await AutoImageProcessor.from_pretrained(MODEL)
  const model = await TF[M.vision].from_pretrained(MODEL, { dtype: 'q8' })
  let k = 0
  for (const s of missing) {
    try {
      const out = await model(await processor(await RawImage.read(s.path)))
      vecCache[s.path] = norm(out[M.visionOut].data).map((x) => +x.toFixed(5))
    } catch (e) { console.warn('skip', s.path, e.message); vecCache[s.path] = null }
    if (++k % 100 === 0) { console.log(`embedded ${k}/${missing.length}`); writeFileSync(vecFile, JSON.stringify(vecCache)) }
  }
  writeFileSync(vecFile, JSON.stringify(vecCache))
}
for (const s of samples) s.vec = vecCache[s.path]
const dot = (a, b) => { let d = 0; for (let k = 0; k < a.length; k++) d += a[k] * b[k]; return d }

// Commons 的搜尋結果有雜訊：品項在零樣本前 15 名以外的照片當作搜錯，丟掉（TACO 有人工標註，不過濾）
let dropped = 0
const data = samples.filter((s) => {
  if (!s.vec || !s.accept.length) return false
  if (s.src !== 'web') return true
  const sims = textMat.map((t) => dot(s.vec, t))
  const target = sims[itemIds.indexOf(s.accept[0])]
  const rank = sims.filter((x) => x > target).length
  if (rank >= 15) { dropped++; return false }
  return true
})
const train = data.filter((s) => !isTest(s.group))
const test = data.filter((s) => isTest(s.group))

// ── 評分（和 src/vision/clip.ts 的 score() 相同公式） ───────────────
function protosFrom(set, k) {
  const by = {}
  for (const s of set) for (const id of s.accept.slice(0, 1)) (by[id] ??= []).push(s.vec)
  const out = {}
  for (const [id, vs] of Object.entries(by)) out[id] = k >= vs.length ? vs : farthestPoint(vs, k)
  return out
}
// 挑彼此差最多的 k 個（涵蓋不同角度、背景）
function farthestPoint(vs, k) {
  const mean = norm(vs[0].map((_, j) => vs.reduce((a, v) => a + v[j], 0)))
  let first = 0, bestD = -1
  vs.forEach((v, i) => { const d = dot(v, mean); if (d > bestD) { bestD = d; first = i } })
  const pick = [first]
  const minSim = vs.map((v) => dot(v, vs[first]))
  while (pick.length < k) {
    let j = -1, lo = Infinity
    minSim.forEach((s, i) => { if (!pick.includes(i) && s < lo) { lo = s; j = i } })
    pick.push(j)
    vs.forEach((v, i) => { minSim[i] = Math.max(minSim[i], dot(v, vs[j])) })
  }
  return pick.map((i) => vs[i])
}

function evaluate(set, P, protos, mat = textMat) {
  let top1 = 0, top3 = 0, kind = 0, nothing = 0, nll = 0
  const perSrc = {}
  const calib = []
  for (const s of set) {
    const logits = mat.map((t, i) => {
      let l = dot(s.vec, t) * P.TEMPERATURE
      for (const pv of protos[itemIds[i]] ?? []) l += P.PROTO_ALPHA * Math.exp(-P.PROTO_BETA * (1 - dot(s.vec, pv)))
      return l
    })
    const negL = negMat.map((t) => dot(s.vec, t) * P.TEMPERATURE)
    const mx = Math.max(...logits, ...negL)
    const z = [...logits, ...negL].reduce((a, l) => a + Math.exp(l - mx), 0)
    const order = logits.map((l, i) => [l, i]).sort((a, b) => b[0] - a[0])
    const best = itemIds[order[0][1]]
    const ok1 = s.accept.includes(best)
    const ok3 = order.slice(0, 3).some(([, i]) => s.accept.includes(itemIds[i]))
    const okKind = s.accept.some((a) => byId[a].kind === byId[best].kind)
    const isNothing = Math.max(...negL) > order[0][0]
    const pAcc = s.accept.reduce((a, id) => a + Math.exp(logits[itemIds.indexOf(id)] - mx), 0) / z
    // 依孩子的桶加總機率：品項不確定時，可能還是很確定是哪一類
    const kindMass = {}
    logits.forEach((l, i) => { const k = byId[itemIds[i]].kind; kindMass[k] = (kindMass[k] ?? 0) + Math.exp(l - mx) / z })
    const [bestKind, kMass] = Object.entries(kindMass).sort((a, b) => b[1] - a[1])[0]
    calib.push({
      p1: Math.exp(order[0][0] - mx) / z, p2: Math.exp(order[1][0] - mx) / z, ok: ok1 && !isNothing, okKind: okKind && !isNothing,
      kMass, okBestKind: s.accept.some((a) => byId[a].kind === bestKind), item: s.src === 'web' ? s.label : `TACO ${s.label}`, guess: best,
    })
    top1 += ok1 && !isNothing; top3 += ok3; kind += okKind && !isNothing; nothing += isNothing; nll -= Math.log(Math.max(1e-6, pAcc))
    const r = (perSrc[s.src] ??= { n: 0, top1: 0, kind: 0 })
    r.n++; r.top1 += ok1 && !isNothing; r.kind += okKind && !isNothing
  }
  const n = set.length || 1
  return { n: set.length, top1: top1 / n, top3: top3 / n, kind: kind / n, nothing: nothing / n, nll: nll / n, perSrc, calib }
}

const base = { TEMPERATURE: 100, PROTO_ALPHA: 0, PROTO_BETA: 5.5, PROTOS_PER_ITEM: 0 }
const baseline = evaluate(test, base, {})

// ── 網格搜尋：只用訓練組做範例向量，但選參數要避免過擬合測試組 → 再把訓練組切一半做驗證 ──
const isVal = (g) => createHash('sha1').update('val:' + g).digest()[0] % 2 === 0
const fit = train.filter((s) => !isVal(s.group))
const val = train.filter((s) => isVal(s.group))
const grid = []
for (const k of [2, 4, 8])
  for (const a of [4, 8, 12, 20, 30, 50])
    for (const b of [3, 5.5, 8, 12, 16, 24])
      for (const T of [50, 100]) {
        const P = { TEMPERATURE: T, PROTO_ALPHA: a, PROTO_BETA: b, PROTOS_PER_ITEM: k }
        const r = evaluate(val, P, protosFrom(fit, k))
        grid.push({ P, r })
      }
grid.sort((x, y) => y.r.top1 - x.r.top1 || y.r.kind - x.r.kind || x.r.nll - y.r.nll)
const bestP = grid[0].P
// 溫度：在最佳設定下，用驗證組 NLL 選（影響畫面上的信心 %，不影響排名）
let bestT = bestP.TEMPERATURE, bestNll = Infinity
for (const T of [30, 50, 75, 100, 150]) {
  const r = evaluate(val, { ...bestP, TEMPERATURE: T }, protosFrom(fit, bestP.PROTOS_PER_ITEM))
  if (r.top1 >= grid[0].r.top1 - 0.005 && r.nll < bestNll) { bestNll = r.nll; bestT = T }
}
const protoOnly = { ...bestP, TEMPERATURE: bestT }
const protoOnlyTest = evaluate(test, protoOnly, protosFrom(train, protoOnly.PROTOS_PER_ITEM))
const zeroShotT = evaluate(test, { ...base, TEMPERATURE: bestT }, {})

// ── 從照片學每個品項的分類向量（few-shot 線性探測，從文字向量出發） ─────────────
//   logit_c = T · (w_c · v)；最小化 交叉熵（可接受品項平分目標）＋ λ‖w_c − w_c⁰‖²（w⁰＝文字向量，避免離太遠）
//   只用訓練組；λ、學習率、回合數用驗證組選。手機上只是把文字向量換成學到的向量，速度不變。
const C = itemIds.length, D = textMat[0].length
const idx = Object.fromEntries(itemIds.map((id, i) => [id, i]))
function trainW(set, { lambda, lr, epochs, T }, onCheckpoint) {
  const W = textMat.map((r) => Float64Array.from(r))
  const X = set.map((s) => Float64Array.from(s.vec))
  const Y = set.map((s) => s.accept.map((a) => idx[a]).filter((i) => i != null))
  const logit = new Float64Array(C)
  for (let ep = 1; ep <= epochs; ep++) {
    const G = W.map(() => new Float64Array(D))
    for (let n = 0; n < X.length; n++) {
      const x = X[n]
      let mx = -Infinity
      for (let c = 0; c < C; c++) { let d = 0; const w = W[c]; for (let k = 0; k < D; k++) d += w[k] * x[k]; logit[c] = d * T; if (logit[c] > mx) mx = logit[c] }
      let z = 0
      for (let c = 0; c < C; c++) { logit[c] = Math.exp(logit[c] - mx); z += logit[c] }
      const y = Y[n], yw = 1 / y.length
      for (let c = 0; c < C; c++) {
        const g = (logit[c] / z - (y.includes(c) ? yw : 0)) * T / X.length
        if (Math.abs(g) < 1e-7) continue
        const Gc = G[c]
        for (let k = 0; k < D; k++) Gc[k] += g * x[k]
      }
    }
    for (let c = 0; c < C; c++) {
      const w = W[c], w0 = textMat[c], Gc = G[c]
      for (let k = 0; k < D; k++) w[k] -= lr * (Gc[k] + 2 * lambda * (w[k] - w0[k]))
    }
    if (onCheckpoint && [100, 300, 600].includes(ep)) onCheckpoint(ep, W.map((r) => Array.from(r)))
  }
  return W.map((r) => Array.from(r))
}
const adaptGrid = []
// 試過 λ∈{0.02…3}、lr∈{0.005…2}：lr 太大會發散，λ 太大等於沒學；最佳在 λ≈0.3、lr=0.01
for (const lambda of [0.1, 0.3, 1])
  for (const lr of [0.01]) {
    const t0 = Date.now()
    trainW(fit, { lambda, lr, epochs: 600, T: bestT }, (ep, W) => {
      const line = []
      for (const a of [0, 4, 12]) {
        const P = { ...protoOnly, PROTO_ALPHA: a, PROTOS_PER_ITEM: a ? protoOnly.PROTOS_PER_ITEM : 0 }
        const r = evaluate(val, P, a ? protosFrom(fit, P.PROTOS_PER_ITEM) : {}, W)
        adaptGrid.push({ lambda, lr, epochs: ep, P, r })
        line.push(`α=${a}:${(r.top1 * 100).toFixed(1)}%/nothing ${(r.nothing * 100).toFixed(1)}%`)
      }
      const trainAcc = evaluate(fit, { ...protoOnly, PROTO_ALPHA: 0 }, {}, W).top1
      console.log(`  λ=${lambda} lr=${lr} ep=${ep} train ${(trainAcc * 100).toFixed(1)}% | val ${line.join('  ')}`)
    })
    console.log(`adapt λ=${lambda} lr=${lr}: ${((Date.now() - t0) / 1000).toFixed(0)}s`)
  }
adaptGrid.sort((x, y) => y.r.top1 - x.r.top1 || y.r.kind - x.r.kind || x.r.nll - y.r.nll)
const bestA = adaptGrid[0]
const useAdapt = bestA.r.top1 > grid[0].r.top1 + 0.005
const tuned = useAdapt ? bestA.P : protoOnly
const shippedW = useAdapt ? trainW(train, { lambda: bestA.lambda, lr: bestA.lr, epochs: bestA.epochs, T: tuned.TEMPERATURE }) : null
const shipped = tuned.PROTOS_PER_ITEM && tuned.PROTO_ALPHA ? protosFrom(train, tuned.PROTOS_PER_ITEM) : {}
const final = evaluate(test, tuned, shipped, shippedW ?? textMat)

// ── 不確定時要不要回答（選擇性預測）：顯示出來的答案至少 TARGET 對，在這個條件下盡量多顯示 ──
//   第一層：品項（p1 ≥ SHOW_P，或 p1 ≥ SHOW_P_MIN 且 ≥ SHOW_RATIO × p2）→ 顯示「寶特瓶」
//   第二層：品項不確定，但某一個桶的機率加總 ≥ KIND_P → 只顯示「塑膠類」
//   其他：不回答（「看不清楚，換個角度」）
const TARGET = 0.85
// 只能用「沒看過驗證組」的模型（範例向量與分類向量都只用 fit）來選門檻，否則門檻會太鬆
const valCal = evaluate(val, tuned, tuned.PROTO_ALPHA ? protosFrom(fit, tuned.PROTOS_PER_ITEM) : {}, useAdapt ? trainW(fit, { lambda: bestA.lambda, lr: bestA.lr, epochs: bestA.epochs, T: tuned.TEMPERATURE }) : textMat).calib
const itemRule = (R) => (c) => c.p1 >= R.SHOW_P || (c.p1 >= R.SHOW_P_MIN && c.p1 >= R.SHOW_RATIO * c.p2)
let bestRule = null
for (const SHOW_P of [0.25, 0.3, 0.35, 0.4, 0.5, 0.6])
  for (const SHOW_P_MIN of [0.1, 0.15, 0.2, 0.25])
    for (const SHOW_RATIO of [1.5, 2, 2.5, 3, 4]) {
      if (SHOW_P_MIN > SHOW_P) continue
      const R = { SHOW_P, SHOW_P_MIN, SHOW_RATIO }
      const shown = valCal.filter(itemRule(R))
      const prec = shown.filter((c) => c.ok).length / (shown.length || 1)
      if (prec >= TARGET && (!bestRule || shown.length > bestRule.cov)) bestRule = { ...R, cov: shown.length }
    }
bestRule ??= { SHOW_P: 0.6, SHOW_P_MIN: 0.25, SHOW_RATIO: 4, cov: 0 }
let bestKindP = 0.9
for (const KIND_P of [0.4, 0.5, 0.6, 0.7, 0.8, 0.9]) {
  const rest = valCal.filter((c) => !itemRule(bestRule)(c) && c.kMass >= KIND_P)
  const prec = rest.filter((c) => c.okBestKind).length / (rest.length || 1)
  if (prec >= TARGET) { bestKindP = KIND_P; break }
}
// 第三層「可能是 X？」：品項和桶都不夠確定，但第一名機率 ≥ MAYBE_P。選最低的門檻，讓這一層的品項至少 MAYBE_TARGET 對
const MAYBE_TARGET = 0.5
let bestMaybe = 0.5
// 下限 0.3：手拿照片的完整流程驗證（src/vision/evalPipeline.ts）顯示 0.3 以下的猜測大多是錯的
for (const MAYBE_P of [0.3, 0.35, 0.4, 0.5]) {
  const band = valCal.filter((c) => !itemRule(bestRule)(c) && c.kMass < bestKindP && c.p1 >= MAYBE_P)
  const prec = band.filter((c) => c.ok).length / (band.length || 1)
  if (band.length && prec >= MAYBE_TARGET) { bestMaybe = MAYBE_P; break }
}
// 快速回答（看一次就說）：即時掃描平常要看 2 次才回答（約 1.3 秒）；第一次就很有把握時直接說。
// 選最低的 FAST_P，讓「看一次、p1 ≥ FAST_P」的品項在驗證組至少 FAST_TARGET 對（比一般回答更嚴，因為沒有多次平均）
const FAST_TARGET = 0.93
let bestFast = 0.95
for (const FAST_P of [0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8, 0.85, 0.9, 0.95]) {
  const x = valCal.filter((c) => c.p1 >= FAST_P)
  if (x.length >= 20 && x.filter((c) => c.ok).length / x.length >= FAST_TARGET) { bestFast = FAST_P; break }
}
// 常見品項（items.json 的 freq 3：杯子、瓶罐、袋子、果皮…）：孩子最常掃的東西，門檻另外選（同樣至少 FAST_TARGET 對），讓它們更快說出名字
const isCommon = (c) => (byId[c.guess]?.freq ?? 1) >= 3
let bestFastCommon = bestFast
for (const FAST_P of [0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8, 0.85, 0.9, 0.95]) {
  if (FAST_P >= bestFast) break
  const x = valCal.filter((c) => isCommon(c) && c.p1 >= FAST_P)
  if (x.length >= 20 && x.filter((c) => c.ok).length / x.length >= FAST_TARGET) { bestFastCommon = FAST_P; break }
}
const rule = { SHOW_P: bestRule.SHOW_P, SHOW_P_MIN: bestRule.SHOW_P_MIN, SHOW_RATIO: bestRule.SHOW_RATIO, KIND_P: bestKindP, MAYBE_P: bestMaybe, FAST_P: bestFast, FAST_P_COMMON: bestFastCommon }
const sel = (() => {
  const cal = final.calib
  const item = cal.filter(itemRule(rule))
  const kind = cal.filter((c) => !itemRule(rule)(c) && c.kMass >= rule.KIND_P)
  const maybe = cal.filter((c) => !itemRule(rule)(c) && c.kMass < rule.KIND_P && c.p1 >= rule.MAYBE_P)
  const unsure = cal.length - item.length - kind.length - maybe.length
  const n = cal.length || 1
  return {
    item: item.length / n, itemAcc: item.filter((c) => c.ok).length / (item.length || 1), itemKindAcc: item.filter((c) => c.okKind).length / (item.length || 1),
    kind: kind.length / n, kindAcc: kind.filter((c) => c.okBestKind).length / (kind.length || 1),
    maybe: maybe.length / n, maybeAcc: maybe.filter((c) => c.ok).length / (maybe.length || 1), maybeKindAcc: maybe.filter((c) => c.okKind).length / (maybe.length || 1),
    unsure: unsure / n,
    fastCommon: cal.filter(isCommon).length ? cal.filter((c) => isCommon(c) && c.p1 >= rule.FAST_P_COMMON).length / cal.filter(isCommon).length : 0,
    fastCommonAcc: cal.filter((c) => isCommon(c) && c.p1 >= rule.FAST_P_COMMON && c.ok).length / (cal.filter((c) => isCommon(c) && c.p1 >= rule.FAST_P_COMMON).length || 1),
    fast: cal.filter((c) => c.p1 >= rule.FAST_P).length / n, fastAcc: cal.filter((c) => c.p1 >= rule.FAST_P && c.ok).length / (cal.filter((c) => c.p1 >= rule.FAST_P).length || 1),
    wrongShown: (item.filter((c) => !c.okKind).length + kind.filter((c) => !c.okBestKind).length + maybe.filter((c) => !c.okKind).length) / n,
  }
})()

// ── 輸出 ───────────────────────────────────────────────
const pct = (x) => `${(x * 100).toFixed(1)}%`
const row = (name, r) => `| ${name} | ${r.n} | ${pct(r.top1)} | ${pct(r.top3)} | ${pct(r.kind)} | ${pct(r.nothing)} |`
const srcRow = (name, r) => Object.entries(r.perSrc).map(([k, v]) => `| ${name}（${k}） | ${v.n} | ${pct(v.top1 / v.n)} | ${pct(v.kind / v.n)} |`).join('\n')
const coveredItems = new Set(train.flatMap((s) => s.accept.slice(0, 1)))
// 每個品項的測試組準確率（下一輪要補照片的品項從最差的開始）
const perItem = (() => {
  const m = {}
  for (const c of final.calib) { const r = (m[c.item] ??= { n: 0, ok: 0, okKind: 0, wrong: {} }); r.n++; r.ok += c.ok; r.okKind += c.okKind; if (!c.ok) r.wrong[c.guess] = (r.wrong[c.guess] ?? 0) + 1 }
  return Object.entries(m).map(([id, r]) => ({ id, zh: byId[id]?.name.zh ?? id, ...r, acc: r.ok / r.n, kindAcc: r.okKind / r.n, top: Object.entries(r.wrong).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([g, k]) => `${byId[g]?.name.zh ?? g}×${k}`).join('、') })).sort((a, b) => a.acc - b.acc || b.n - a.n)
})()
writeFileSync(join(CACHE, 'per-item.json'), JSON.stringify(perItem, null, 1))
const report = `# ${M.name === "siglip" ? "SigLIP" : "CLIP"} 調參報告（${new Date().toISOString().slice(0, 10)}，文字模板 ${embeds.variant ?? 'home'}）

資料：TACO 裁切 ${samples.filter((s) => s.src === 'taco').length} 張、Wikimedia Commons ${samples.filter((s) => s.src === 'web').length} 張（搜錯過濾掉 ${dropped} 張）。
切分（依來源照片）：訓練 ${train.length}、測試 ${test.length}；有範例向量的品項 ${coveredItems.size}/${itemIds.length}。

| 設定 | 測試張數 | 品項第一名 | 前三名 | 分到對的桶 | 被判成「不是垃圾」 |
|---|---|---|---|---|---|
${row('零樣本（只用文字描述）', baseline)}
${row('零樣本，溫度 ' + bestT, zeroShotT)}
${row(`只加範例向量（${protoOnly.PROTOS_PER_ITEM}/品項、α=${protoOnly.PROTO_ALPHA}、β=${protoOnly.PROTO_BETA}、溫度 ${protoOnly.TEMPERATURE}）`, protoOnlyTest)}
${row(useAdapt ? `**學習分類向量**（λ=${bestA.lambda}、lr=${bestA.lr}、${bestA.epochs} 回合${tuned.PROTO_ALPHA ? `＋範例向量 α=${tuned.PROTO_ALPHA}` : ''}、溫度 ${tuned.TEMPERATURE}）` : '最終（同上，學習分類向量在驗證組沒有更好）', final)}

依來源：

| 設定 | 張數 | 第一名 | 對的桶 |
|---|---|---|---|
${srcRow('零樣本', baseline)}
${srcRow('調參後', final)}

信心與準確率（調參後，測試組；畫面顯示名字的門檻參考：tracker.ts 的 SHOW_P／SHOW_P_MIN＋SHOW_RATIO）：

| 第一名機率 | 佔比 | 品項對 | 桶子對 |
|---|---|---|---|
${[[0.5, 1.01], [0.3, 0.5], [0.2, 0.3], [0.12, 0.2], [0, 0.12]].map(([lo, hi]) => { const b = final.calib.filter((c) => c.p1 >= lo && c.p1 < hi); return `| ${lo}–${Math.min(1, hi)} | ${pct(b.length / final.n)} | ${b.length ? pct(b.filter((c) => c.ok).length / b.length) : '-'} | ${b.length ? pct(b.filter((c) => c.okKind).length / b.length) : '-'} |` }).join('\n')}

不確定時要不要回答（驗證組選門檻：顯示出來的至少 ${pct(TARGET)} 對；以下是測試組）：
SHOW_P=${rule.SHOW_P}、SHOW_P_MIN=${rule.SHOW_P_MIN}、SHOW_RATIO=${rule.SHOW_RATIO}、KIND_P=${rule.KIND_P}、MAYBE_P=${rule.MAYBE_P}、FAST_P=${rule.FAST_P}\n\n看一次就回答（p1 ≥ FAST_P）：佔 ${pct(sel.fast)}，品項對 ${pct(sel.fastAcc)}\n常見品項（FAST_P_COMMON=${rule.FAST_P_COMMON}）：猜成常見品項的照片有 ${pct(sel.fastCommon)} 看一次就說，品項對 ${pct(sel.fastCommonAcc)}

| 畫面上 | 佔比 | 準確率 |
|---|---|---|
| 顯示品項名稱（例：寶特瓶） | ${pct(sel.item)} | 品項 ${pct(sel.itemAcc)}、桶子 ${pct(sel.itemKindAcc)} |
| 只顯示桶子（例：塑膠類，換個角度看看） | ${pct(sel.kind)} | 桶子 ${pct(sel.kindAcc)} |
| 「可能是 X？」 | ${pct(sel.maybe)} | 品項 ${pct(sel.maybeAcc)}、桶子 ${pct(sel.maybeKindAcc)} |
| 不回答（只畫主要的框） | ${pct(sel.unsure)} | — |

顯示出來（含「可能是」）但桶子錯的：${pct(sel.wrongShown)}（不做選擇、全部都回答時：${pct(1 - final.kind)}）

每個品項（測試組，最差的 25 個；全部在 testdata/cache/per-item.json）：

| 品項 | 張數 | 品項對 | 桶子對 | 常被認成 |
|---|---|---|---|---|
${perItem.slice(0, 25).map((r) => `| ${r.zh} | ${r.n} | ${pct(r.acc)} | ${pct(r.kindAcc)} | ${r.top} |`).join('\n')}

學習分類向量：驗證組最佳 第一名 ${pct(bestA.r.top1)}（只加範例向量 ${pct(grid[0].r.top1)}）→ ${useAdapt ? '採用' : '不採用'}

驗證組前 5 名設定（範例向量）：
${grid.slice(0, 5).map((g) => `- k=${g.P.PROTOS_PER_ITEM}, α=${g.P.PROTO_ALPHA}, β=${g.P.PROTO_BETA}, T=${g.P.TEMPERATURE} → 第一名 ${pct(g.r.top1)}、對的桶 ${pct(g.r.kind)}`).join('\n')}

注意：Commons 照片用「品項在零樣本前 15 名」過濾搜錯，會讓 Commons 部分的數字略為偏高；TACO 部分是人工標註、沒有過濾，比較可靠。
TACO 多是戶外地上的垃圾，和家裡拍的情境不同；最後仍要用自己拍的照片（testdata/photos）驗證。
`
console.log(report)
writeFileSync(join(CACHE, 'tune-report.md'), report)
if (!NO_WRITE) {
  const paramsFile = 'src/vision/params.json'
  const prev = existsSync(paramsFile) ? JSON.parse(readFileSync(paramsFile, 'utf8')) : {}
  writeFileSync(paramsFile, JSON.stringify({
    ...prev,
    MODEL: M.name,
    TEMPERATURE: tuned.TEMPERATURE, PROTO_ALPHA: tuned.PROTO_ALPHA, PROTO_BETA: tuned.PROTO_BETA, PROTOS_PER_ITEM: tuned.PROTOS_PER_ITEM, CLASS_WEIGHTS: !!shippedW,
    SHOW_P: rule.SHOW_P, SHOW_P_MIN: rule.SHOW_P_MIN, SHOW_RATIO: rule.SHOW_RATIO, KIND_P: rule.KIND_P, MAYBE_P: rule.MAYBE_P, FAST_P: rule.FAST_P, FAST_P_COMMON: rule.FAST_P_COMMON,
    tuned: {
      date: new Date().toISOString().slice(0, 10),
      test: { n: final.n, top1: +final.top1.toFixed(3), top3: +final.top3.toFixed(3), kind: +final.kind.toFixed(3) },
      baseline: { top1: +baseline.top1.toFixed(3), kind: +baseline.kind.toFixed(3) },
      selective: Object.fromEntries(Object.entries(sel).map(([k, v]) => [k, +v.toFixed(3)])),
    },
  }, null, 2) + '\n')
  const SRC = 'TACO (CC BY 4.0) + Wikimedia Commons (CC0/PD/CC BY/CC BY-SA), train split only'
  const out = { version: 2, model: MODEL, arch: M.name, dtype: 'q8', dim: M.dim, encoding: 'int8-base64', source: SRC, items: {} }
  for (const [id, vs] of Object.entries(shipped)) out.items[id] = vs.map(encodeProto)
  writeFileSync('public/data/image_protos.json', JSON.stringify(out))
  // 學到的分類向量（取代文字向量；n＝向量長度，v＝方向，int8 壓縮）。不採用時刪掉舊檔，App 會用文字向量
  const cwFile = 'public/data/class_weights.json'
  if (shippedW) {
    const cw = { version: 1, model: MODEL, encoding: 'norm+int8-base64', temperature: tuned.TEMPERATURE, lambda: bestA.lambda, epochs: bestA.epochs, source: SRC, items: {} }
    shippedW.forEach((w, i) => { const n = Math.hypot(...w); cw.items[itemIds[i]] = { n: +n.toFixed(5), v: encodeProto(w) } })
    writeFileSync(cwFile, JSON.stringify(cw))
  } else if (existsSync(cwFile)) unlinkSync(cwFile)
  console.log(`wrote src/vision/params.json, public/data/image_protos.json（${Object.keys(out.items).length} 個品項）`)
}
