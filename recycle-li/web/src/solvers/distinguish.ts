// 分辨卡：教孩子「怎麼分辨」。全部由規則表推出來（items.json 的 attrs、group、kind 與 questions.json），不用生成式 AI。
//   clues      這個東西的特徵（是紙做的、有一層膜…）
//   lookAlikes 同一群（例如「喝的」）裡長得像、但要丟不同桶的東西，和最能分出它們的那一個問題
import { binsFor, correctBin, kindMeta, questions } from '@/domain/catalog'
import type { AgeBand, AttrId, Item, Question } from '@/domain/types'

export interface Clue { q: Question; yes: boolean; label: string; icon: string }
export interface LookAlike {
  other: Item
  otherBin: { label: string; color: string; icon: string }
  /** 分辨的問題：這個東西的答案 vs 另一個的答案；沒有可以分的特徵時是 null */
  diff: { q: Question; mine: { label: string; icon: string }; theirs: { label: string; icon: string } } | null
}

const attr = (i: Item, id: AttrId) => i.attrs?.[id] === true

export function cluesOf(item: Item, max = 4): Clue[] {
  return questions
    .filter((q) => item.attrs?.[q.id] !== undefined)
    .map((q) => {
      const yes = item.attrs[q.id] === true
      const side = yes ? q.yes : q.no
      return { q, yes, label: side.label, icon: side.icon }
    })
    .sort((a, b) => Number(b.yes) - Number(a.yes))
    .slice(0, max)
}

/** 孩子的桶（依年齡）；不進桶的（危險、大型、特殊）用類別本身 */
export function binOf(item: Item, age: AgeBand) {
  const b = correctBin(item, age)
  const bin = b ? binsFor(age).find((x) => x.id === b) : undefined
  const k = kindMeta[item.kind]
  return bin ? { label: bin.label, color: bin.color, icon: bin.icon } : { label: k.label, color: k.color, icon: k.icon }
}

export function lookAlikes(item: Item, items: Item[], age: AgeBand, max = 2): LookAlike[] {
  const mine = binOf(item, age).label
  const shared = (o: Item) => questions.filter((q) => attr(item, q.id) && attr(o, q.id)).length
  return items
    .filter((o) => o.id !== item.id && o.group === item.group && o.status !== 'conflict' && o.kind !== 'unknown' && binOf(o, age).label !== mine)
    .sort((a, b) => shared(b) - shared(a) || b.freq - a.freq || a.id.localeCompare(b.id))
    .slice(0, max)
    .map((other) => {
      const q = questions.find((q) => attr(item, q.id) !== attr(other, q.id) && (item.attrs?.[q.id] !== undefined || other.attrs?.[q.id] !== undefined))
      return {
        other,
        otherBin: binOf(other, age),
        diff: q ? { q, mine: attr(item, q.id) ? q.yes : q.no, theirs: attr(other, q.id) ? q.yes : q.no } : null,
      }
    })
}
