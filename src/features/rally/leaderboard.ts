import type { LeaderboardRow } from './rally.types'

export type RankBy = 'totalEarned' | 'money'

// Organizer rule (2026-11-22): Total Earned = balance + assets, so upgrades do not lose points.
export const RANK_BY: RankBy = 'totalEarned'

export type RankedRow = LeaderboardRow & { rank: number }

export function rankLeaderboard(rows: LeaderboardRow[], by: RankBy = RANK_BY): RankedRow[] {
  const sorted = [...rows].sort(
    (a, b) => b[by] - a[by] || b.customerCount - a.customerCount || a.teamNumber - b.teamNumber,
  )
  const ranked: RankedRow[] = []
  sorted.forEach((row, index) => {
    const previous = ranked[index - 1]
    const tied = previous && previous[by] === row[by] && previous.customerCount === row.customerCount
    ranked.push({ ...row, rank: tied ? previous.rank : index + 1 })
  })
  return ranked
}

export function demoLeaderboard(): LeaderboardRow[] {
  return Array.from({ length: 15 }, (_, index) => ({
    teamId: `demo-${index + 1}`,
    teamNumber: index + 1,
    name: `Tim ${index + 1}`,
    money: 850 - index * 34,
    assetValue: 0,
    totalEarned: 850 - index * 34,
    customerCount: Math.max(0, 12 - index),
    resultsCount: 0,
  }))
}
