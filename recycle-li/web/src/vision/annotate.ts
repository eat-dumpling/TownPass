// YOLO 風格的標註：彩色框＋四角加粗＋框上方的標籤（品項名稱、信心、孩子的桶）。
// 即時掃描與辨識測試室共用。顏色用回收標誌的類別色；還沒認出來的框是白色虛線＋「辨識中」。

export interface Annotation {
  x: number; y: number; w: number; h: number // 畫布座標
  color: string
  title?: string // 例：寶特瓶
  sub?: string // 例：塑膠類
  conf?: number // 0–1
  pending?: boolean // 還在辨識
  selected?: boolean
}

const FONT = '"PingFang TC", "Noto Sans TC", "Microsoft JhengHei", sans-serif'

export function drawAnnotations(g: CanvasRenderingContext2D, list: Annotation[], W: number) {
  for (const a of list) {
    const lw = a.selected ? 5 : 3.5
    g.save()
    g.strokeStyle = a.pending ? 'rgba(255,255,255,.9)' : a.color
    g.lineWidth = a.pending ? 2.5 : lw
    if (a.pending) g.setLineDash([10, 8])
    roundRect(g, a.x, a.y, a.w, a.h, 10)
    g.stroke()
    g.setLineDash([])
    if (!a.pending) {
      // 四角加粗（像相機對焦框）
      const c = Math.min(26, a.w / 4, a.h / 4)
      g.lineWidth = lw + 3
      g.lineCap = 'round'
      g.beginPath()
      g.moveTo(a.x, a.y + c); g.lineTo(a.x, a.y); g.lineTo(a.x + c, a.y)
      g.moveTo(a.x + a.w - c, a.y); g.lineTo(a.x + a.w, a.y); g.lineTo(a.x + a.w, a.y + c)
      g.moveTo(a.x + a.w, a.y + a.h - c); g.lineTo(a.x + a.w, a.y + a.h); g.lineTo(a.x + a.w - c, a.y + a.h)
      g.moveTo(a.x + c, a.y + a.h); g.lineTo(a.x, a.y + a.h); g.lineTo(a.x, a.y + a.h - c)
      g.stroke()
    }
    // 標籤
    const title = a.pending ? a.title ?? '辨識中…' : a.title ?? ''
    if (title) {
      const pct = !a.pending && a.conf != null ? ` ${Math.round(a.conf * 100)}%` : ''
      g.font = `800 17px ${FONT}`
      const tw = g.measureText(title + pct).width
      g.font = `600 12px ${FONT}`
      const sw = a.sub && !a.pending ? g.measureText(a.sub).width : 0
      const bw = Math.min(W - 4, Math.max(tw, sw) + 20)
      const bh = a.sub && !a.pending ? 44 : 28
      const bx = Math.min(Math.max(2, a.x - lw / 2), W - bw - 2)
      let by = a.y - bh - 4
      if (by < 2) by = a.y + 4 // 框在最上面時把標籤放進框裡
      g.fillStyle = a.pending ? 'rgba(0,0,0,.55)' : a.color
      roundRect(g, bx, by, bw, bh, 8)
      g.fill()
      g.fillStyle = '#fff'
      g.font = `800 17px ${FONT}`
      g.fillText(title + pct, bx + 10, by + 20)
      if (a.sub && !a.pending) {
        g.font = `600 12px ${FONT}`
        g.globalAlpha = 0.92
        g.fillText(a.sub, bx + 10, by + 37)
      }
    }
    g.restore()
  }
}

export function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  r = Math.max(0, Math.min(r, w / 2, h / 2))
  g.beginPath()
  g.moveTo(x + r, y)
  g.arcTo(x + w, y, x + w, y + h, r)
  g.arcTo(x + w, y + h, x, y + h, r)
  g.arcTo(x, y + h, x, y, r)
  g.arcTo(x, y, x + w, y, r)
  g.closePath()
}

/** object-fit: cover 的座標換算（影片 → 畫面） */
export function coverTransform(vw: number, vh: number, W: number, H: number) {
  const s = Math.max(W / vw, H / vh)
  return { s, ox: (W - vw * s) / 2, oy: (H - vh * s) / 2 }
}
