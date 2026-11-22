import type { Shop, TycoonSnapshot } from './tycoon.types'

export type TycoonRows = {
  tycoon: { money: number; capacity: number; customer_count: number; is_open: boolean }
  catalog: { id: string; name: string; upgrade_costs: number[] }[]
  owned: { shop_id: string; level: number }[]
}

export const MAX_SHOP_LEVEL = 3

// Cost to reach level n is upgrade_costs[n - 1], so the next level costs upgrade_costs[level].
export function toSnapshot(rows: TycoonRows): TycoonSnapshot {
  const levels = new Map(rows.owned.map((row) => [row.shop_id, row.level]))
  const shops: Shop[] = rows.catalog.map((item) => {
    const level = levels.get(item.id) ?? 0
    const maxed = level >= MAX_SHOP_LEVEL
    return {
      id: item.id as Shop['id'],
      name: item.name,
      level,
      owned: level > 0,
      upgradeCost: maxed ? 0 : (item.upgrade_costs[level] ?? 0),
      maxed,
    }
  })
  return {
    money: rows.tycoon.money,
    capacity: rows.tycoon.capacity,
    customers: rows.tycoon.customer_count,
    isOpen: rows.tycoon.is_open,
    shops,
  }
}
