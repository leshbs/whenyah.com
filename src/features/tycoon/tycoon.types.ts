export type Shop = {
  id: 'kiosk' | 'arcade' | 'cafe'
  name: string
  level: number
  owned: boolean
  upgradeCost: number // cost of the next level (buy or upgrade); 0 when maxed
  maxed?: boolean
}

export type TycoonSnapshot = {
  money: number
  capacity: number
  customers: number
  isOpen: boolean
  shops: Shop[]
}
