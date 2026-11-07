// 畫面上要框哪些東西、怎麼回答（即時掃描 ScanView 和驗證工具 evalPipeline 共用，避免兩邊規則不一樣）。
//
// 框：偵測分數夠高才框（MIN_SCORE）；都不夠高時只留分數最高的一個（FALLBACK_MIN 以上）；最多 MAX_BOXES 個。
// 回答（每個框）：有把握 → 品項名稱；中等 → 「可能是 X？」；只確定桶 → 桶子；沒把握 → 主要的框只畫線不寫字、其他框不畫。
import type { Det, Track } from './tracker'
import { answerLevel } from './tracker'

export const DISPLAY = {
  MIN_SCORE: 0.3, // 偵測分數低於這個值的框不顯示（掛繩、手、衣服的誤框多半很低）
  FALLBACK_MIN: 0.15, // 沒有任何框夠高時，最高的那一個至少要這麼高才用
  MAX_BOXES: 3,
  BIG_MIN: 0.45, // 大型家具家電的框要這麼有把握才用
  BIG_SURE: 0.6, // 大型的框這麼有把握時，前面只有很模糊的小東西也框大型的
}

/** 大型家具家電（桌椅、沙發、床、冰箱、電視、電腦…）：也是要丟的東西，但拍小東西時常常是背景 */
export const BIG_CLASSES = new Set(['dining table', 'chair', 'couch', 'bed', 'bench', 'tv', 'laptop', 'refrigerator', 'oven', 'microwave', 'toaster', 'toilet', 'bicycle'])

export function selectDetections(dets: Det[]): Det[] {
  // 畫面上有一般大小的東西（杯子、瓶子…）時，大型家具家電當背景不框；沒有時才框最有把握的那一個
  const small = dets.filter((d) => !BIG_CLASSES.has(d.label))
  if (small.length < dets.length) {
    const big = dets.filter((d) => BIG_CLASSES.has(d.label) && d.score >= DISPLAY.BIG_MIN).sort((a, b) => b.score - a.score)
    const smallBest = Math.max(0, ...small.map((d) => d.score))
    // 小東西夠清楚（≥ MIN_SCORE），或小東西還可以而大型的不夠確定（< BIG_SURE）→ 框小東西
    if (!big.length || smallBest >= DISPLAY.MIN_SCORE || (smallBest >= DISPLAY.FALLBACK_MIN && big[0].score < DISPLAY.BIG_SURE)) dets = small
    else return [big[0]]
  }
  const sorted = [...dets].sort((a, b) => b.score - a.score)
  const strong = sorted.filter((d) => d.score >= DISPLAY.MIN_SCORE)
  const out = strong.length ? strong : sorted.filter((d) => d.score >= DISPLAY.FALLBACK_MIN || d.label === '').slice(0, 1)
  return out.slice(0, DISPLAY.MAX_BOXES)
}

/** 主要目標：大、靠中間的那一個（畫面上的提示與「沒把握時只畫它」用） */
export function primaryOf(tracks: Track[], vw: number, vh: number): Track | null {
  let best: Track | null = null
  let bestS = -Infinity
  for (const t of tracks) {
    const cx = (t.x + t.w / 2) / vw - 0.5, cy = (t.y + t.h / 2) / vh - 0.5
    const s = Math.sqrt((t.w * t.h) / (vw * vh)) * (1 - Math.min(0.9, Math.hypot(cx, cy) * 1.4))
    if (s > bestS) { bestS = s; best = t }
  }
  return best
}

export type DrawMode = 'item' | 'maybe' | 'kind' | 'silent' | 'hide'
export function drawMode(t: Track, isPrimary: boolean): DrawMode {
  const level = answerLevel(t)
  if (level === 'unsure') return isPrimary ? 'silent' : 'hide'
  return level
}
