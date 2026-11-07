import { describe, expect, it } from 'vitest'
import { allItems, visibleItems } from './catalog'

describe('規則表核對（scripts/verify_items.py）', () => {
  it('每條 verified 規則都寫明和哪份官方資料比對過', () => {
    const verified = allItems.filter((i) => i.status === 'verified')
    expect(verified.length).toBeGreaterThanOrEqual(80)
    for (const i of verified) expect(i.verified_by, i.id).toMatch(/回收一點通|data\.taipei/)
  })

  it('正式版只顯示 verified 與 conflict，不顯示 unknown', () => {
    const shown = visibleItems(false)
    expect(shown.some((i) => i.status === 'unknown')).toBe(false)
    expect(shown.length).toBe(allItems.filter((i) => i.status !== 'unknown').length)
  })

  it('Demo 會用到的常見品項都已核對', () => {
    for (const id of ['bubble_tea_cup', 'pet_bottle', 'aluminum_can', 'tetra_pak', 'glass_bottle', 'paper_cup', 'old_book', 'plastic_bag_dirty']) {
      expect(allItems.find((i) => i.id === id)?.status, id).toBe('verified')
    }
  })
})
