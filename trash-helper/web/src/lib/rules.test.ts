import { describe, expect, it } from 'vitest'
import { allItems } from '@/domain/catalog'
import { bagKey, nextDay, taipeiDow, whenOf, GARBAGE_DAYS } from './rules'
import { nearby, type StopRow } from './stops'

const it_ = (id: string) => allItems.find((i) => i.id === id)!

describe('collection rules (Taipei)', () => {
  it('general trash: every day except Wed and Sun', () => {
    expect(whenOf(it_('tissue'))).toEqual({ mode: 'days', days: GARBAGE_DAYS })
    expect(GARBAGE_DAYS).not.toContain(3)
    expect(GARBAGE_DAYS).not.toContain(0)
  })
  it('3D recyclables Tue/Thu/Sat, flat Mon/Fri (from the official CSV)', () => {
    expect(whenOf(it_('pet_bottle'))).toEqual({ mode: 'days', days: [2, 4, 6] })
    expect(whenOf(it_('newspaper'))).toEqual({ mode: 'days', days: [1, 5] })
    expect(whenOf(it_('plastic_bag_clean'))).toEqual({ mode: 'days', days: [1, 5] })
  })
  it('bulky items need a booking, needles go to a clinic, conflicts ask first', () => {
    expect(whenOf(it_('mattress')).mode).toBe('book')
    expect(whenOf(it_('needle')).mode).toBe('clinic')
    expect(whenOf(it_('eggshell')).mode).toBe('ask')
  })
  it('bag type', () => {
    expect(bagKey(it_('tissue'))).toBe('general')
    expect(bagKey(it_('leftovers'))).toBe('food')
    expect(bagKey(it_('pet_bottle'))).toBe('recycle')
    expect(bagKey(it_('battery'))).toBe('hazard')
  })
  it('next collection day', () => {
    expect(nextDay([2, 4, 6], 3)).toEqual({ dow: 4, inDays: 1 }) // 週三 → 週四
    expect(nextDay([1, 5], 1)).toEqual({ dow: 1, inDays: 0 }) // 今天就可以
    expect(nextDay([1, 5], 6)).toEqual({ dow: 1, inDays: 2 }) // 週六 → 週一
  })
  it('Taipei weekday', () => {
    expect(taipeiDow(new Date('2026-11-07T20:00:00+08:00'))).toBe(6) // 週六
    expect(taipeiDow(new Date('2026-11-07T17:00:00Z'))).toBe(0) // 臺北已經是週日凌晨
  })
})

describe('nearby stops', () => {
  const s = (address: string, lat: number, lng: number, arrive = 1170): StopRow => ({ district: '士林區', li: '天壽里', route: 'A', trip: '1', arrive, leave: arrive + 10, address, lat, lng })
  it('sorts by distance, dedups addresses, estimates walking time', () => {
    const list = nearby([s('far', 25.13, 121.53), s('near', 25.1185, 121.525), s('near', 25.1185, 121.525)], { lat: 25.1184, lng: 121.525 })
    expect(list.map((x) => x.address)).toEqual(['near'])
    expect(list[0].walkMin).toBe(1)
  })
})
