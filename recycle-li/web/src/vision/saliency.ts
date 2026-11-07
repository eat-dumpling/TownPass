// 顯著物體框：偵測器框不到東西時（鋁箔包、電池這類 COCO 沒有的類別），
// 找出畫面中央「跟背景不一樣」的那一塊，框住它——框是貼著物品的，不是固定的瞄準框。
//
// 做法（便宜、每秒可跑好幾次）：縮成 96px 寬 → 用畫面外圈當背景樣本，算每個像素和背景的顏色距離＋邊緣強度
// → Otsu 自動門檻 → 從中央附近找最大的連通區塊 → 外接矩形。找不到明顯的物品就回傳 null（不畫框）。
import type { Det } from './tracker'

const W = 96
let canvas: HTMLCanvasElement | null = null

export function salientBox(src: CanvasImageSource, vw: number, vh: number): Det | null {
  const H = Math.max(8, Math.round((W * vh) / vw))
  canvas ??= document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const g = canvas.getContext('2d', { willReadFrequently: true })!
  g.drawImage(src, 0, 0, W, H)
  const px = g.getImageData(0, 0, W, H).data
  const n = W * H

  // 背景：外圈 8% 的平均顏色與變化量
  const ring = Math.max(2, Math.round(W * 0.08))
  let br = 0, bg = 0, bb = 0, cnt = 0
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (x >= ring && x < W - ring && y >= ring && y < H - ring) continue
    const i = (y * W + x) * 4
    br += px[i]; bg += px[i + 1]; bb += px[i + 2]; cnt++
  }
  br /= cnt; bg /= cnt; bb /= cnt

  // 每個像素的「不像背景」分數：顏色距離＋邊緣
  const lum = new Float32Array(n)
  for (let k = 0; k < n; k++) lum[k] = 0.299 * px[k * 4] + 0.587 * px[k * 4 + 1] + 0.114 * px[k * 4 + 2]
  const sal = new Float32Array(n)
  let max = 1
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const k = y * W + x, i = k * 4
    const dc = Math.hypot(px[i] - br, px[i + 1] - bg, px[i + 2] - bb)
    const gx = lum[k + 1] - lum[k - 1], gy = lum[k + W] - lum[k - W]
    const v = dc + 0.6 * Math.hypot(gx, gy)
    sal[k] = v
    if (v > max) max = v
  }
  // Otsu 門檻
  const hist = new Array(64).fill(0)
  for (let k = 0; k < n; k++) hist[Math.min(63, Math.floor((sal[k] / max) * 64))]++
  let sum = 0
  for (let t = 0; t < 64; t++) sum += t * hist[t]
  let sumB = 0, wB = 0, best = 0, thr = 32
  for (let t = 0; t < 64; t++) {
    wB += hist[t]
    if (!wB) continue
    const wF = n - wB
    if (!wF) break
    sumB += t * hist[t]
    const mB = sumB / wB, mF = (sum - sumB) / wF
    const between = wB * wF * (mB - mF) ** 2
    if (between > best) { best = between; thr = t }
  }
  const cut = ((thr + 1) / 64) * max
  if (max < 40) return null // 整個畫面都差不多（對著牆）

  // 連通區塊（4 鄰居），選面積夠大、離中心近的
  const lab = new Int32Array(n)
  const stack: number[] = []
  let bestBox: { x0: number; y0: number; x1: number; y1: number; area: number; score: number } | null = null
  let id = 0
  for (let s = 0; s < n; s++) {
    if (lab[s] || sal[s] < cut) continue
    id++
    let x0 = W, y0 = H, x1 = 0, y1 = 0, area = 0, sx = 0, sy = 0
    stack.push(s)
    lab[s] = id
    while (stack.length) {
      const k = stack.pop()!
      const x = k % W, y = (k - x) / W
      area++; sx += x; sy += y
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y
      for (const nb of [k - 1, k + 1, k - W, k + W]) {
        if (nb < 0 || nb >= n || lab[nb] || sal[nb] < cut) continue
        if ((nb === k - 1 && x === 0) || (nb === k + 1 && x === W - 1)) continue
        lab[nb] = id
        stack.push(nb)
      }
    }
    const frac = area / n
    if (frac < 0.01) continue
    const bw = x1 - x0 + 1, bh = y1 - y0 + 1
    // 太寬或太大的多半是背景（例如體育館的看台、天花板），不是手上的一個東西
    if (bw > W * 0.8 || bh > H * 0.9 || frac > 0.45) continue
    const cx = sx / area / W - 0.5, cy = sy / area / H - 0.5
    const score = Math.sqrt(frac) * (1 - Math.min(0.9, Math.hypot(cx, cy) * 1.6))
    if (!bestBox || score > bestBox.score) bestBox = { x0, y0, x1, y1, area, score }
  }
  if (!bestBox || bestBox.score < 0.05) return null
  const sxs = vw / W, sys = vh / H
  const pad = 1
  const x = Math.max(0, bestBox.x0 - pad) * sxs, y = Math.max(0, bestBox.y0 - pad) * sys
  const w = Math.min(W, bestBox.x1 + 1 + pad) * sxs - x, h = Math.min(H, bestBox.y1 + 1 + pad) * sys - y
  return { x, y, w, h, label: '', score: Math.min(1, bestBox.score * 2) }
}
