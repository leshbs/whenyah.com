import { describe, expect, it } from 'vitest'
import { rankLeaderboard } from '../../src/features/rally/leaderboard'
import type { LeaderboardRow } from '../../src/features/rally/rally.types'

const row = (teamNumber: number, totalEarned: number, customerCount: number, money = totalEarned): LeaderboardRow => ({
  teamId: `t${teamNumber}`, teamNumber, name: `Tim ${teamNumber}`, money, assetValue: totalEarned - money, totalEarned, customerCount, resultsCount: 0,
})

describe('rankLeaderboard', () => {
  it('sorts by total earned (balance + assets), then customers, then team number', () => {
    const ranked = rankLeaderboard([row(3, 100, 5), row(1, 100, 8), row(2, 200, 1)])
    expect(ranked.map((r) => r.teamNumber)).toEqual([2, 1, 3])
    expect(ranked.map((r) => r.rank)).toEqual([1, 2, 3])
  })

  it('gives identical score and customers the same rank', () => {
    const ranked = rankLeaderboard([row(1, 100, 5), row(2, 100, 5), row(3, 50, 5)])
    expect(ranked.map((r) => r.rank)).toEqual([1, 1, 3])
  })

  it('does not punish a team for spending money on assets', () => {
    // Team 1 invested 200 into shops (balance 100, assets 200); team 2 hoarded 250.
    const ranked = rankLeaderboard([row(2, 250, 0, 250), row(1, 300, 0, 100)])
    expect(ranked[0]?.teamNumber).toBe(1)
  })

  it('can rank by current money instead', () => {
    const ranked = rankLeaderboard([row(1, 300, 0, 10), row(2, 100, 0, 90)], 'money')
    expect(ranked[0]?.teamNumber).toBe(2)
  })
})
