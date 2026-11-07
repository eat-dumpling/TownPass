// 2.5D 等角投影（isometric）繪圖工具。一格地塊寬 TW、高 TH（2:1），高度 1 單位＝TZ。
// 座標：x 往右下、y 往左下、z 往上；一格 = 1×1。看得到的面：上面、+x 面（右）、+y 面（左）。
// 光從左上來：上面最亮、左面中等、右面最暗；每個面用漸層，邊線用同色系的深色（插畫感，不用黑框）。
export const TW = 64
export const TH = 32
export const TZ = 32

export type P3 = [number, number, number]
export const proj = ([x, y, z]: P3): [number, number] => [(x - y) * (TW / 2), (x + y) * (TH / 2) - z * TZ]
const f = (v: number) => +v.toFixed(2)
const pts = (ps: P3[]) => ps.map((p) => proj(p).map(f).join(',')).join(' ')

/** 漸層（物件座標 0–1）：l＝線性、r＝放射 */
export type Grad =
  | { type: 'l'; x1: number; y1: number; x2: number; y2: number; stops: string[] }
  | { type: 'r'; cx: number; cy: number; r: number; stops: string[] }
export interface PartBase { fill: string; grad?: Grad; stroke?: string; sw?: number; opacity?: number; blur?: boolean }
export type Part =
  | (PartBase & { kind: 'poly'; points: string })
  | (PartBase & { kind: 'path'; d: string })
  | (PartBase & { kind: 'ball'; cx: number; cy: number; r: number })
  | (PartBase & { kind: 'line'; points: string })

/** 顏色變亮或變暗（-1～1） */
export function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16)
  const ch = (v: number) => Math.round(amt < 0 ? v * (1 + amt) : v + (255 - v) * amt)
  const r = ch(n >> 16), g = ch((n >> 8) & 255), b = ch(n & 255)
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)
}
export const gradId = (g: Grad) => 'ig' + [g.type, ...Object.values(g).flat()].join('').replace(/[^a-zA-Z0-9]/g, '').slice(0, 60)
const vgrad = (top: string, bottom: string): Grad => ({ type: 'l', x1: 0, y1: 0, x2: 0, y2: 1, stops: [top, bottom] })
const line = (c: string) => shade(c, -0.42)

/** 一個面（四邊形），自動加深色邊線 */
export function face(ps: P3[], color: string, g?: Grad): Part {
  return { kind: 'poly', points: pts(ps), fill: color, grad: g, stroke: line(color), sw: 0.6 }
}

/** 長方體：原點 (x,y,z)、大小 (dx,dy,dz) */
export function box(x: number, y: number, z: number, dx: number, dy: number, dz: number, color: string, top?: string): Part[] {
  const X = x + dx, Y = y + dy, Z = z + dz
  const L = shade(color, -0.06), R = shade(color, -0.26), T = top ?? shade(color, 0.14)
  return [
    face([[x, Y, z], [X, Y, z], [X, Y, Z], [x, Y, Z]], L, vgrad(shade(L, 0.08), shade(L, -0.12))),
    face([[X, y, z], [X, Y, z], [X, Y, Z], [X, y, Z]], R, vgrad(shade(R, 0.06), shade(R, -0.14))),
    face([[x, y, Z], [X, y, Z], [X, Y, Z], [x, Y, Z]], T, { type: 'l', x1: 0, y1: 0, x2: 1, y2: 1, stops: [shade(T, 0.1), T] }),
  ]
}

/** 人字形屋頂（脊沿 x 方向），屋簷往外伸 o；前坡畫瓦片線 */
export function roof(x: number, y: number, z: number, dx: number, dy: number, h: number, color: string, o = 0.06): Part[] {
  const x0 = x - o, X = x + dx + o, y0 = y - o, Y = y + dy + o, M = y + dy / 2, Z = z + h
  const parts: Part[] = [
    face([[X, y0, z], [X, Y, z], [X, M, Z]], shade(color, -0.3)), // 山牆
    face([[x0, y0, z], [X, y0, z], [X, M, Z], [x0, M, Z]], shade(color, 0.22)), // 後坡
    face([[x0, M, Z], [X, M, Z], [X, Y, z], [x0, Y, z]], color, vgrad(shade(color, 0.12), shade(color, -0.12))), // 前坡
  ]
  for (let k = 1; k < 4; k++) {
    const t = k / 4
    const yy = M + (Y - M) * t, zz = Z + (z - Z) * t
    parts.push({ kind: 'line', points: pts([[x0 + 0.02, yy, zz], [X - 0.02, yy, zz]]), fill: 'none', stroke: shade(color, -0.25), sw: 0.7 })
  }
  parts.push({ kind: 'line', points: pts([[x0, M, Z], [X, M, Z]]), fill: 'none', stroke: shade(color, -0.4), sw: 1.6 }) // 屋脊
  return parts
}

/** 平面（地上的東西：花圃土、步道、水面） */
export function flat(x: number, y: number, z: number, dx: number, dy: number, color: string, opacity?: number, g?: Grad): Part {
  return { kind: 'poly', points: pts([[x, y, z], [x + dx, y, z], [x + dx, y + dy, z], [x, y + dy, z]]), fill: color, opacity, grad: g }
}
/** 任意四邊形（斜面、牆上的窗） */
export function quad(a: P3, b: P3, c: P3, d: P3, color: string, g?: Grad): Part {
  return face([a, b, c, d], color, g)
}
/** 線（欄杆、腳踏車架、水柱） */
export function seg(ps: P3[], color: string, width = 1.4): Part {
  return { kind: 'line', points: pts(ps), fill: 'none', stroke: color, sw: width }
}

/** 球（樹冠、花、石頭）：放射漸層＋亮點 */
export function ball(x: number, y: number, z: number, r: number, color: string): Part {
  const [cx, cy] = proj([x, y, z])
  return { kind: 'ball', cx: f(cx), cy: f(cy), r: f(r * TW * 0.5), fill: color, stroke: line(color), sw: 0.6, grad: { type: 'r', cx: 0.35, cy: 0.3, r: 0.75, stops: [shade(color, 0.32), color, shade(color, -0.25)] } }
}

// 地上半徑 r 的圓投影成橢圓：rx = r·TW/√2、ry = r·TH/√2
const RX = (r: number) => (r * TW) / Math.SQRT2
const RY = (r: number) => (r * TH) / Math.SQRT2

/** 直立圓柱（樹幹、飲水台、燈塔）：側面左亮右暗、上面一個橢圓 */
export function cyl(x: number, y: number, z: number, r: number, h: number, color: string, top?: string, r2 = r): Part[] {
  const [cx, cyb] = proj([x, y, z]), [, cyt] = proj([x, y, z + h])
  const a = RX(r), b = RY(r), a2 = RX(r2), b2 = RY(r2)
  const d = `M ${f(cx - a)} ${f(cyb)} A ${f(a)} ${f(b)} 0 0 0 ${f(cx + a)} ${f(cyb)} L ${f(cx + a2)} ${f(cyt)} A ${f(a2)} ${f(b2)} 0 0 0 ${f(cx - a2)} ${f(cyt)} Z`
  const T = top ?? shade(color, 0.16)
  return [
    { kind: 'path', d, fill: color, stroke: line(color), sw: 0.6, grad: { type: 'l', x1: 0, y1: 0, x2: 1, y2: 0, stops: [shade(color, 0.2), color, shade(color, -0.3)] } },
    { kind: 'path', d: `M ${f(cx - a2)} ${f(cyt)} A ${f(a2)} ${f(b2)} 0 1 0 ${f(cx + a2)} ${f(cyt)} A ${f(a2)} ${f(b2)} 0 1 0 ${f(cx - a2)} ${f(cyt)} Z`, fill: T, stroke: line(T), sw: 0.5 },
  ]
}
/** 圓錐（松樹、燈塔屋頂） */
export function cone(x: number, y: number, z: number, r: number, h: number, color: string): Part {
  const [cx, cy] = proj([x, y, z]), [, ty] = proj([x, y, z + h])
  const a = RX(r), b = RY(r)
  return { kind: 'path', d: `M ${f(cx - a)} ${f(cy)} L ${f(cx)} ${f(ty)} L ${f(cx + a)} ${f(cy)} A ${f(a)} ${f(b)} 0 0 1 ${f(cx - a)} ${f(cy)} Z`, fill: color, stroke: line(color), sw: 0.6, grad: { type: 'l', x1: 0, y1: 0, x2: 1, y2: 0.3, stops: [shade(color, 0.22), color, shade(color, -0.28)] } }
}
/** 立體空間裡的圓（車輪、風車輪轂）：plane 'x' 表示圓在 x=常數 的平面上 */
export function ring(x: number, y: number, z: number, r: number, plane: 'x' | 'y', color: string, width = 1.6, fill = 'none'): Part {
  const ps: P3[] = []
  for (let k = 0; k <= 20; k++) {
    const t = (k / 20) * Math.PI * 2
    ps.push(plane === 'x' ? [x, y + r * Math.cos(t), z + r * Math.sin(t)] : [x + r * Math.cos(t), y, z + r * Math.sin(t)])
  }
  return { kind: fill === 'none' ? 'line' : 'poly', points: pts(ps), fill, stroke: color, sw: width } as Part
}
/** 柔和的影子（地上的模糊橢圓），往右下偏，配合左上的光 */
export function shadow(x: number, y: number, r: number, strength = 0.22): Part {
  const [cx, cy] = proj([x + 0.08, y + 0.04, 0])
  return { kind: 'path', d: `M ${f(cx - RX(r))} ${f(cy)} A ${f(RX(r))} ${f(RY(r))} 0 1 0 ${f(cx + RX(r))} ${f(cy)} A ${f(RX(r))} ${f(RY(r))} 0 1 0 ${f(cx - RX(r))} ${f(cy)} Z`, fill: '#0E2A1A', opacity: strength, blur: true }
}

/** 地塊（有厚度的菱形草地）：縮圖、地圖用 */
export function tile(gx: number, gy: number, color: string, depth = 0.18): Part[] {
  return box(gx, gy, -depth, 1, 1, depth, color, color)
}

/** 把零件整組平移到 (gx, gy) 那一格 */
export function place(parts: Part[], gx: number, gy: number): Part[] {
  const [dx, dy] = proj([gx, gy, 0])
  const mv = (s: string) => s.split(' ').map((p) => { const [a, b] = p.split(',').map(Number); return `${f(a + dx)},${f(b + dy)}` }).join(' ')
  const mvd = (d: string) => {
    // path 只用 M/L/A/Z：M、L 後面兩個數是座標；A 後面 7 個數，最後兩個是座標
    const tok = d.split(' ')
    const out: string[] = []
    for (let i = 0; i < tok.length; ) {
      const t = tok[i]
      if (t === 'M' || t === 'L') { out.push(t, String(f(+tok[i + 1] + dx)), String(f(+tok[i + 2] + dy))); i += 3 }
      else if (t === 'A') { out.push(t, ...tok.slice(i + 1, i + 6), String(f(+tok[i + 6] + dx)), String(f(+tok[i + 7] + dy))); i += 8 }
      else { out.push(t); i++ }
    }
    return out.join(' ')
  }
  return parts.map((p) =>
    p.kind === 'ball' ? { ...p, cx: f(p.cx + dx), cy: f(p.cy + dy) } : p.kind === 'path' ? { ...p, d: mvd(p.d) } : { ...p, points: mv(p.points) },
  )
}
