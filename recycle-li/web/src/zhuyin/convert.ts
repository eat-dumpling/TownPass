// 數字聲調拼音（例如 lv3、zhang3、de0）→ 注音，格式與全字庫字音資料相同：
// 一聲不標、二三四聲標在後面（ˊˇˋ）、輕聲標在前面（˙）。只在建置時（gen-zhuyin.mjs）與測試用。
const INITIALS: [string, string][] = [
  ['zh', 'ㄓ'], ['ch', 'ㄔ'], ['sh', 'ㄕ'], ['b', 'ㄅ'], ['p', 'ㄆ'], ['m', 'ㄇ'], ['f', 'ㄈ'], ['d', 'ㄉ'], ['t', 'ㄊ'],
  ['n', 'ㄋ'], ['l', 'ㄌ'], ['g', 'ㄍ'], ['k', 'ㄎ'], ['h', 'ㄏ'], ['j', 'ㄐ'], ['q', 'ㄑ'], ['x', 'ㄒ'], ['r', 'ㄖ'],
  ['z', 'ㄗ'], ['c', 'ㄘ'], ['s', 'ㄙ'],
]
const FINALS: Record<string, string> = {
  a: 'ㄚ', o: 'ㄛ', e: 'ㄜ', ê: 'ㄝ', ai: 'ㄞ', ei: 'ㄟ', ao: 'ㄠ', ou: 'ㄡ', an: 'ㄢ', en: 'ㄣ', ang: 'ㄤ', eng: 'ㄥ', er: 'ㄦ', ong: 'ㄨㄥ',
  i: 'ㄧ', ia: 'ㄧㄚ', io: 'ㄧㄛ', ie: 'ㄧㄝ', iai: 'ㄧㄞ', iao: 'ㄧㄠ', iu: 'ㄧㄡ', iou: 'ㄧㄡ', ian: 'ㄧㄢ', in: 'ㄧㄣ', iang: 'ㄧㄤ', ing: 'ㄧㄥ', iong: 'ㄩㄥ',
  u: 'ㄨ', ua: 'ㄨㄚ', uo: 'ㄨㄛ', uai: 'ㄨㄞ', ui: 'ㄨㄟ', uei: 'ㄨㄟ', uan: 'ㄨㄢ', un: 'ㄨㄣ', uen: 'ㄨㄣ', uang: 'ㄨㄤ', ueng: 'ㄨㄥ',
  ü: 'ㄩ', üe: 'ㄩㄝ', üan: 'ㄩㄢ', ün: 'ㄩㄣ',
}
const TONE = ['˙', '', 'ˊ', 'ˇ', 'ˋ', '˙']

export function pinyinToZhuyin(py: string): string {
  const m = /^([a-zêüv:]+)([0-5])?$/i.exec(py.trim().toLowerCase().replace(/v|u:/g, 'ü'))
  if (!m) return ''
  let s = m[1]
  const tone = m[2] === undefined ? 1 : Number(m[2])
  // 整體認讀與零聲母的拼法
  if (s === 'ng' || s === 'n' || s === 'm') return ''
  if (s === 'yu' || s.startsWith('yu')) s = 'ü' + s.slice(2)
  else if (s === 'yi' || s === 'wu') s = s[1]
  else if (s.startsWith('yi')) s = 'i' + s.slice(2)
  else if (s.startsWith('wu')) s = 'u' + s.slice(2)
  else if (s.startsWith('y')) s = 'i' + s.slice(1)
  else if (s.startsWith('w')) s = 'u' + s.slice(1)
  let ini = ''
  for (const [p, z] of INITIALS) if (s.startsWith(p) && s.length > p.length) { ini = z; s = s.slice(p.length); break }
  // j q x 後面的 u 是 ü
  if ('ㄐㄑㄒ'.includes(ini) && ini && s.startsWith('u')) s = 'ü' + s.slice(1)
  let fin: string
  if (ini && 'ㄓㄔㄕㄖㄗㄘㄙ'.includes(ini) && s === 'i') fin = '' // zhi chi shi ri zi ci si
  else if (ini && 'ㄅㄆㄇㄈ'.includes(ini) && s === 'o') fin = 'ㄛ'
  else if (s === 'e' && !ini) fin = 'ㄜ'
  else fin = FINALS[s] ?? ''
  if (!fin && !(ini && s === 'i')) return ''
  const body = ini + fin
  if (tone === 0 || tone === 5) return '˙' + body
  return body + TONE[tone]
}
