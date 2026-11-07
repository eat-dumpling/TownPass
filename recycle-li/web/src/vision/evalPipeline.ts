// 完整流程驗證（開發用，在瀏覽器裡跑，和手機同一套程式）：偵測 → 選框 → 追蹤 → CLIP（含先驗）→ 怎麼回答 → 畫幾個框。
// 用「手拿著東西」的真實照片（Wikimedia Commons，testdata/hand/），模擬即時掃描：每個框用三種略為不同的裁切各辨識一次（像連續三幀）。
// 用法（開發時在瀏覽器 console）：const m = await import('/src/vision/evalPipeline.ts'); await m.evalPipeline('/_eval/manifest.json')
import { allItems } from '@/domain/catalog'
import { INPUT_SIZE, recognize } from './clip'
import { detect, loadDetector, squareCrop } from './detector'
import { drawMode, primaryOf, selectDetections, type DrawMode } from './pipeline'
import { logPrior, PRIOR_MIN_SCORE } from './prior'
import { salientBox } from './saliency'
import { observe, Tracker, type Det } from './tracker'

export interface EvalRow { file: string; expected: string; drawn: number; mode: DrawMode; said: string | null; okItem: boolean; okKind: boolean; coco: string; guess: string | null; gconf: number; fast: string | null; okFast: boolean }
export interface EvalOptions { select?: boolean; legacy?: boolean; frames?: number; otherPrior?: number; only?: string[] }

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
    let dets: Det[] = detect(det, c, (ts += 100), c.width, c.height)
    if (select) dets = selectDetections(dets)
    if (!dets.length) { const sb = salientBox(c, c.width, c.height); if (sb) dets = [sb] }
    const tr = new Tracker()
    tr.update(dets)
    tr.update(dets) // 第二次出現才算數（和即時一樣）
    const tracks = tr.visible()
    const firstLook = new Map<object, string | null>() // 看一次就說的答案（快速回答）
    for (const t of tracks) {
      for (let f = 0; f < frames; f++) {
        const r = squareCrop(t, c.width, c.height, [0.12, 0.06, 0.2][f % 3])
        crop.getContext('2d')!.drawImage(c, r.sx, r.sy, r.side, r.side, 0, 0, INPUT_SIZE, INPUT_SIZE)
        const res = await recognize(crop, items, {}, logPrior(t.cocoScore >= PRIOR_MIN_SCORE ? t.coco : null, otherPrior))
        observe(t, res.top, res.negative?.p ?? 0)
        if (f === 0) firstLook.set(t, t.fast ? t.label!.id : null)
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
    perItem: Object.fromEntries([...new Set(rows.map((r) => r.expected))].map((id) => {
      const x = rows.filter((r) => r.expected === id)
      return [id, `${x.filter((r) => r.okKind).length}/${x.length} 桶對，${x.filter((r) => r.okItem).length} 品項對`]
    })),
    rows,
  }
}
