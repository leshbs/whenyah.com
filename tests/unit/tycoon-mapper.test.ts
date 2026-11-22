import { describe, expect, it } from 'vitest'
import { toSnapshot } from '../../src/features/tycoon/tycoon.mapper'

const catalog = [
  { id: 'kiosk', name: 'Kios', upgrade_costs: [0, 80, 140] },
  { id: 'arcade', name: 'Arcade', upgrade_costs: [120, 150, 210] },
]
const tycoon = { money: 90, capacity: 12, customer_count: 5, is_open: true }

describe('toSnapshot', () => {
  it('prices the next level from upgrade_costs[level]', () => {
    const snap = toSnapshot({ tycoon, catalog, owned: [{ shop_id: 'kiosk', level: 1 }, { shop_id: 'arcade', level: 0 }] })
    expect(snap.shops.map((s) => [s.id, s.owned, s.upgradeCost])).toEqual([['kiosk', true, 80], ['arcade', false, 120]])
    expect(snap.customers).toBe(5)
  })

  it('marks level 3 as maxed with no further cost', () => {
    const snap = toSnapshot({ tycoon, catalog, owned: [{ shop_id: 'kiosk', level: 3 }] })
    expect(snap.shops[0]?.maxed).toBe(true)
    expect(snap.shops[0]?.upgradeCost).toBe(0)
  })
})
