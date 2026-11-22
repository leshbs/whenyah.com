export type SoloAssignment = {
  positionId: number
  teamId: number
}

export type DuelAssignment = {
  positionId: number
  teamIds: [number, number]
}

export type RallyRound = {
  roundNumber: number
  solo: SoloAssignment[]
  duels: DuelAssignment[]
}

export type PositionKind = 'solo' | 'duel'

// offline: staff hand over the prize and record it. online: the web minigame awards it automatically.
export type PositionDelivery = 'offline' | 'online'

export type EventState = {
  id: string
  name: string
  status: string
  currentRound: number
}

export type LeaderboardRow = {
  teamId: string
  teamNumber: number
  name: string
  money: number
  assetValue: number
  totalEarned: number // money + assetValue
  customerCount: number
  resultsCount: number
}

export type RoundSlotTeam = {
  id: string
  teamNumber: number
  name: string
  level: string | null
}

export type RoundSlot = {
  roundId: string
  positionId: string
  positionNumber: number
  positionName: string
  kind: PositionKind
  delivery: PositionDelivery
  teams: RoundSlotTeam[]
}
