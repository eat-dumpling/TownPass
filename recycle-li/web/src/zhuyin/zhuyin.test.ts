import { describe, expect, it } from 'vitest'
import { annotate, splitZhuyin } from './index'
import { pinyinToZhuyin } from './convert'

const zy = (t: string) => annotate(t).map((x) => x.zy ?? x.ch).join(' ')

describe('pinyinToZhuyin', () => {
  it.each([
    ['zhang3', 'ㄓㄤˇ'], ['lv3', 'ㄌㄩˇ'], ['ju1', 'ㄐㄩ'], ['xue2', 'ㄒㄩㄝˊ'], ['yuan2', 'ㄩㄢˊ'], ['yi1', 'ㄧ'],
    ['wu4', 'ㄨˋ'], ['zhi3', 'ㄓˇ'], ['si1', 'ㄙ'], ['de0', '˙ㄉㄜ'], ['gui4', 'ㄍㄨㄟˋ'], ['liu2', 'ㄌㄧㄡˊ'],
    ['dun4', 'ㄉㄨㄣˋ'], ['xiong2', 'ㄒㄩㄥˊ'], ['bo1', 'ㄅㄛ'], ['er2', 'ㄦˊ'], ['e4', 'ㄜˋ'], ['ying1', 'ㄧㄥ'],
  ])('%s → %s', (py, z) => expect(pinyinToZhuyin(py)).toBe(z))
})

describe('annotate (Taiwan readings)', () => {
  it('uses word readings', () => {
    expect(zy('垃圾')).toBe('ㄌㄜˋ ㄙㄜˋ')
    expect(zy('回收小里長')).toBe('ㄏㄨㄟˊ ㄕㄡ ㄒㄧㄠˇ ㄌㄧˇ ㄓㄤˇ')
    expect(zy('乾淨')).toBe('ㄍㄢ ㄐㄧㄥˋ')
    expect(zy('東西')).toBe('ㄉㄨㄥ ˙ㄒㄧ')
    expect(zy('公園長椅')).toBe('ㄍㄨㄥ ㄩㄢˊ ㄔㄤˊ ㄧˇ')
  })
  it('marks 一 and 不 with their base tone, particles light', () => {
    expect(zy('不要碰')).toBe('ㄅㄨˋ ㄧㄠˋ ㄆㄥˋ')
    expect(zy('學會了')).toBe('ㄒㄩㄝˊ ㄏㄨㄟˋ ˙ㄌㄜ')
    expect(zy('什麼')).toBe('ㄕㄣˊ ˙ㄇㄜ')
  })
  it('子 after a noun is light unless listed', () => {
    expect(zy('桶子')).toBe('ㄊㄨㄥˇ ˙ㄗ')
    expect(zy('官方子類')).toContain('ㄗˇ')
  })
  it('leaves non-Han characters alone', () => {
    expect(annotate('+3 資源！').filter((t) => t.zy).length).toBe(2)
  })
  it('every Han character in the app has a reading', () => {
    expect(annotate('掃一掃要丟的東西，拿資源蓋房子！').every((t) => t.zy || !/\p{Script=Han}/u.test(t.ch))).toBe(true)
  })
})

describe('splitZhuyin', () => {
  it('splits light tone, symbols and tone mark', () => {
    expect(splitZhuyin('ㄓㄤˇ')).toEqual({ light: false, symbols: ['ㄓ', 'ㄤ'], tone: 'ˇ' })
    expect(splitZhuyin('˙ㄌㄜ')).toEqual({ light: true, symbols: ['ㄌ', 'ㄜ'], tone: '' })
  })
})
