// 把一段文字標上注音：先找 WORDS 裡最長的詞，找不到就用單字預設讀音。非中文字不標。
import chars from './chars.json'
import { CHAR_FIX, WORDS, ZI_FULL } from './words'

export interface ZyToken { ch: string; zy: string | null }

const CHARS = chars as Record<string, string>
const MAX_WORD = Math.max(...Object.keys(WORDS).map((w) => [...w].length))
const isHan = (c: string) => /\p{Script=Han}/u.test(c)

export function readingOf(ch: string): string | null {
  return CHAR_FIX[ch] ?? CHARS[ch] ?? null
}

export function annotate(text: string): ZyToken[] {
  const cs = [...text]
  const out: ZyToken[] = []
  for (let i = 0; i < cs.length; ) {
    let hit = 0
    for (let n = Math.min(MAX_WORD, cs.length - i); n >= 2; n--) {
      const w = cs.slice(i, i + n).join('')
      if (WORDS[w]) {
        WORDS[w].split(' ').forEach((zy, k) => out.push({ ch: cs[i + k], zy }))
        hit = n
        break
      }
    }
    if (hit) { i += hit; continue }
    const c = cs[i]
    let zy = isHan(c) ? readingOf(c) : null
    // 名詞後面的「子」念輕聲：房子、桶子、瓶子
    if (c === '子' && i > 0 && isHan(cs[i - 1]) && !ZI_FULL.has(cs[i - 1] + c) && !ZI_FULL.has(c + (cs[i + 1] ?? ''))) zy = '˙ㄗ'
    out.push({ ch: c, zy })
    i++
  }
  return out
}

/** 注音拆成「輕聲點、符號、聲調」方便直排 */
export function splitZhuyin(zy: string): { light: boolean; symbols: string[]; tone: string } {
  const light = zy.startsWith('˙')
  const body = light ? zy.slice(1) : zy
  const m = /[ˊˇˋ]$/.exec(body)
  return { light, symbols: [...(m ? body.slice(0, -1) : body)], tone: m ? m[0] : '' }
}
