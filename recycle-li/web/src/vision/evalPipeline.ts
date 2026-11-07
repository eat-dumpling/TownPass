// 完整流程驗證（開發用，在瀏覽器裡跑，和手機同一套程式）：偵測 → 選框 → 追蹤 → CLIP（含先驗）→ 怎麼回答 → 畫幾個框。
// 用「手拿著東西」的真實照片（Wikimedia Commons，testdata/hand/），模擬即時掃描：每個框用三種略為不同的裁切各辨識一次（像連續三幀）。
// 用法（開發時在瀏覽器 console）：const m = await import('/src/vision/evalPipeline.ts'); await m.evalPipeline('/_eval/manifest.json')
import { allItems } from '@/domain/catalog'
import { INPUT_SIZE, recognize } from './clip'
import { detect, loadDetector, squareCrop } from './detector'
import { chooseBoxes, drawMode, primaryOf, selectDetections, type DrawMode } from './pipeline'
import { logPrior, PRIOR_MIN_SCORE } from './prior'
import { salientBox } from './saliency'
import { observe, Tracker, type Det, type Track } from './tracker'

export interface EvalRow { file: string; expected: string; drawn: number; mode: DrawMode; said: string | null; okItem: boolean; okKind: boolean; coco: string; guess: string | null; gconf: number; fast: string | null; okFast: boolean; seq: string[]; flips: number; firstAnswer: number | null; minCos: number; center: boolean }
export interface EvalOptions { select?: boolean; legacy?: boolean; frames?: number; otherPrior?: number; only?: string[] }

const SHAKE: [number, number][] = [[0, 0], [0.03, -0.02], [-0.03, 0.02], [0.02, 0.03], [-0.02, -0.03], [0.01, 0]]
const cos = (a: number[], b: number[]) => { let d = 0, x = 0, y = 0; for (let i = 0; i < a.length; i++) { d += a[i] * b[i]; x += a[i] * a[i]; y += b[i] * b[i] } return d / (Math.sqrt(x * y) || 1) }
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)
/** 這一幀畫面上會寫什麼（當成主要的框） */
function shownKey(t: Track): string {
  const m = drawMode(t, true)
  return m === 'item' ? `item:${t.label!.id}` : m === 'maybe' ? `maybe:${t.guess!.id}` : m === 'kind' ? `kind:${t.kind}` : '-'
}
function stability(seq: string[]) {
  const first = seq.findIndex((k) => k !== '-')
  let flips = 0
  if (first >= 0) for (let i = first + 1; i < seq.length; i++) if (seq[i] !== seq[i - 1]) flips++
  return { seq, flips, firstAnswer: first >= 0 ? first + 1 : null }
}

export async function evalPipeline(manifestUrl: string, opt: EvalOptions = {}) {
  const { select = true, legacy = false, frames = 3, otherPrior, only } = opt
  const items = allItems // 驗證時用全部品項（正式版的 visibleItems 只含已核對的）
  const byId = Object.fromEntries(items.map((i) => [i.id, i]))
  const det = await loadDetector('efficientdet_lite0')
  const manifest = ((await (await fetch(manifestUrl)).json()) as { file: string; item: string }[]).filter((m) => !only || only.includes(m.item))
  const base = new URL('.', new URL(manifestUrl, location.href)).href
  const crop = document.createElement('canvas')
  crop.width = crop.height = INPUT_SIZE
  const rows: EvalRow[] = []
  let ts = performance.now() + 1e6
  for (const m of manifest) {
    const bmp = await createImageBitmap(await (await fetch(base + m.file)).blob())
    const sc = Math.min(1, 1280 / Math.max(bmp.width, bmp.height))
    const c = document.createElement('canvas')
    c.width = Math.round(bmp.width * sc)
    c.height = Math.round(bmp.height * sc)
    c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height)
    bmp.close()
    const raw: Det[] = detect(det, c, (ts += 100), c.width, c.height)
    let dets: Det[]
    if (!select) { dets = raw; if (!dets.length) { const sb = salientBox(c, c.width, c.height); if (sb) dets = [sb] } } // 舊規則（比較用）
    else dets = chooseBoxes(raw, () => salientBox(c, c.width, c.height), c.width, c.height)
    const tr = new Tracker()
    tr.update(dets)
    tr.update(dets) // 第二次出現才算數（和即時一樣）
    const tracks = tr.visible()
    const firstLook = new Map<object, string | null>() // 看一次就說的答案（快速回答）
    const minCos = new Map<object, number>() // 同一張照片晃動的幀之間，影像向量最低的 cosine（訂 RESET_COS 用）
    const seqs = new Map<object, string[]>() // 每一幀畫面上寫的字（穩定度：換了幾次）
    for (const t of tracks) {
      for (let f = 0; f < frames; f++) {
        // 模擬手會晃：每一幀的框略為移動、裁切邊界不同
        const [dx, dy] = SHAKE[f % SHAKE.length]
        const r = squareCrop({ ...t, x: t.x + dx * t.w, y: t.y + dy * t.h }, c.width, c.height, [0.12, 0.06, 0.2][f % 3])
        crop.getContext('2d')!.drawImage(c, r.sx, r.sy, r.side, r.side, 0, 0, INPUT_SIZE, INPUT_SIZE)
        const res = await recognize(crop, items, {}, logPrior(t.cocoScore >= PRIOR_MIN_SCORE ? t.coco : null, otherPrior))
        const prevVec = t.lastVec
        observe(t, res.top, res.negative?.p ?? 0, res.vec)
        if (prevVec) minCos.set(t, Math.min(minCos.get(t) ?? 1, cos(prevVec, res.vec)))
        if (f === 0) firstLook.set(t, t.fast ? t.label!.id : null)
        const seq = seqs.get(t) ?? []
        seq.push(shownKey(t))
        seqs.set(t, seq)
      }
    }
    const primary = primaryOf(tracks, c.width, c.height)
    // legacy：舊規則（每個框都畫；只有品項／桶子／看不清楚）
    const modes = tracks.map((t) => {
      const mode = drawMode(t, t === primary)
      return legacy && mode === 'hide' ? 'silent' : legacy && mode === 'maybe' ? 'silent' : mode
    })
    const pm = primary ? modes[tracks.indexOf(primary)] : 'hide'
    const said = !primary ? null : pm === 'item' ? primary.label!.id : pm === 'maybe' ? primary.guess!.id : null
    const saidKind = !primary ? null : pm === 'kind' ? primary.kind : said ? byId[said]?.kind : null
    rows.push({
      file: m.file, expected: m.item, drawn: modes.filter((x) => x !== 'hide').length, mode: pm,
      said, okItem: said === m.item, okKind: !!saidKind && saidKind === byId[m.item]?.kind,
      coco: primary ? `${primary.coco || 'saliency'}:${primary.cocoScore.toFixed(2)}` : '-', guess: primary?.guess?.id ?? null, gconf: +(primary?.guessConf ?? 0).toFixed(2),
      fast: primary ? firstLook.get(primary) ?? null : null, okFast: !!primary && firstLook.get(primary) === m.item,
      ...stability(primary ? seqs.get(primary) ?? [] : []), minCos: primary ? +(minCos.get(primary) ?? 1).toFixed(3) : 1, center: !!primary?.center,
    })
  }
  const n = rows.length || 1
  const answered = rows.filter((r) => r.mode === 'item' || r.mode === 'maybe' || r.mode === 'kind')
  const by = (mode: DrawMode) => { const x = rows.filter((r) => r.mode === mode); return { share: x.length / n, item: x.filter((r) => r.okItem).length / (x.length || 1), kind: x.filter((r) => r.okKind).length / (x.length || 1) } }
  return {
    n: rows.length,
    boxesPerImage: rows.reduce((s, r) => s + r.drawn, 0) / n,
    moreThan2Boxes: rows.filter((r) => r.drawn > 2).length / n,
    answered: answered.length / n,
    answeredItemAcc: answered.filter((r) => r.okItem).length / (answered.length || 1),
    answeredKindAcc: answered.filter((r) => r.okKind).length / (answered.length || 1),
    fast: { share: rows.filter((r) => r.fast).length / n, item: rows.filter((r) => r.okFast).length / (rows.filter((r) => r.fast).length || 1), kind: rows.filter((r) => r.fast && byId[r.fast]?.kind === byId[r.expected]?.kind).length / (rows.filter((r) => r.fast).length || 1) },
    item: by('item'), maybe: by('maybe'), kind: by('kind'), silent: by('silent').share,
    // 穩定度：開始回答之後，畫面上的字又換掉的比例與次數；第幾幀開始回答
    stable: {
      flickered: rows.filter((r) => r.flips > 0).length / n,
      flipsPerImage: rows.reduce((s, r) => s + r.flips, 0) / n,
      firstAnswerFrame: avg(rows.map((r) => r.firstAnswer).filter((x): x is number => x != null)),
    },
    perItem: Object.fromEntries([...new Set(rows.map((r) => r.expected))].map((id) => {
      const x = rows.filter((r) => r.expected === id)
      return [id, `${x.filter((r) => r.okKind).length}/${x.length} 桶對，${x.filter((r) => r.okItem).length} 品項對`]
    })),
    rows,
  }
}
