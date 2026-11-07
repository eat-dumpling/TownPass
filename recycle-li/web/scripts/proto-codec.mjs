import { readFileSync } from 'node:fs'
// 範例向量的壓縮格式（int8＋縮放係數，base64）：每個 512 維向量約 690 個字元，比 JSON 數字小約 8 倍。
// 格式："<scale>:<base64 of Int8Array(512)>"，還原：v[i] = int8[i] / 127 × scale，再正規化。
// 和 src/vision/clip.ts 的 decodeProto() 必須一致。
export function encodeProto(v) {
  let m = 0
  for (const x of v) m = Math.max(m, Math.abs(x))
  const scale = m || 1
  const q = new Int8Array(v.length)
  for (let i = 0; i < v.length; i++) q[i] = Math.max(-127, Math.min(127, Math.round((v[i] / scale) * 127)))
  return `${scale.toFixed(6)}:${Buffer.from(q.buffer).toString('base64')}`
}

export function decodeProto(p) {
  if (Array.isArray(p)) return normalize(p)
  const [sc, b64] = p.split(':')
  const q = new Int8Array(Buffer.from(b64, 'base64'))
  return normalize(Array.from(q, (x) => (x / 127) * Number(sc)))
}
export function loadProtos(file) {
  return Object.fromEntries(Object.entries(JSON.parse(readFileSync(file, 'utf8')).items ?? {}).map(([id, l]) => [id, l.map(decodeProto)]))
}
function normalize(v) { let s = 0; for (const x of v) s += x * x; const n = Math.sqrt(s) || 1; return v.map((x) => x / n) }

/** class_weights.json → { id: 向量（含長度） } */
export function loadClassWeights(file) {
  const j = JSON.parse(readFileSync(file, 'utf8'))
  return Object.fromEntries(Object.entries(j.items ?? {}).map(([id, { n, v }]) => [id, decodeProto(v).map((x) => x * n)]))
}
