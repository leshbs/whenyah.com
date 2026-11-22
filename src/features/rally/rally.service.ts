import { supabase } from '../../lib/supabase'
import { toSnapshot } from '../tycoon/tycoon.mapper'
import type { TycoonSnapshot } from '../tycoon/tycoon.types'
import type { EventState, LeaderboardRow, PositionDelivery, PositionKind, RoundSlot } from './rally.types'

// Single integration boundary with Supabase. Pages never import the client directly.
// All economy mutations happen in database functions (see supabase/migrations/006).

function client() {
  if (!supabase) throw new Error('Supabase is not configured')
  return supabase
}

export async function fetchEvent(): Promise<EventState | null> {
  const { data, error } = await client()
    .from('events')
    .select('id, name, status, current_round')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return { id: data.id, name: data.name, status: data.status, currentRound: data.current_round }
}

export async function fetchLeaderboard(): Promise<LeaderboardRow[]> {
  const { data, error } = await client()
    .from('leaderboard')
    .select('team_id, team_number, name, money, customer_count, asset_value, total_earned, results_count')
  if (error) throw error
  return (data ?? []).map((row) => ({
    teamId: row.team_id,
    teamNumber: row.team_number,
    name: row.name,
    money: row.money,
    assetValue: row.asset_value,
    totalEarned: row.total_earned,
    customerCount: row.customer_count,
    resultsCount: row.results_count,
  }))
}

type AssignmentRow = {
  round_id: string
  position_id: string
  team_id: string
  positions: { position_number: number; name: string; kind: PositionKind; delivery: PositionDelivery }
  teams: { team_number: number; name: string }
}

export async function fetchRoundSlots(eventId: string, roundNumber: number): Promise<RoundSlot[]> {
  const { data, error } = await client()
    .from('round_assignments')
    .select(
      'round_id, position_id, team_id, rounds!inner(round_number, event_id), positions!inner(position_number, name, kind, delivery), teams!inner(team_number, name)',
    )
    .eq('rounds.event_id', eventId)
    .eq('rounds.round_number', roundNumber)
  if (error) throw error

  const rows = (data ?? []) as unknown as AssignmentRow[]
  const roundId = rows[0]?.round_id
  const levels = new Map<string, string>()
  if (roundId) {
    const results = await client().from('position_results').select('position_id, team_id, level').eq('round_id', roundId)
    if (results.error) throw results.error
    for (const result of results.data ?? []) levels.set(`${result.position_id}:${result.team_id}`, result.level)
  }

  const slots = new Map<string, RoundSlot>()
  for (const row of rows) {
    const slot = slots.get(row.position_id) ?? {
      roundId: row.round_id,
      positionId: row.position_id,
      positionNumber: row.positions.position_number,
      positionName: row.positions.name,
      kind: row.positions.kind,
      delivery: row.positions.delivery,
      teams: [],
    }
    slot.teams.push({
      id: row.team_id,
      teamNumber: row.teams.team_number,
      name: row.teams.name,
      level: levels.get(`${row.position_id}:${row.team_id}`) ?? null,
    })
    slots.set(row.position_id, slot)
  }
  return [...slots.values()]
    .map((slot) => ({ ...slot, teams: [...slot.teams].sort((a, b) => a.teamNumber - b.teamNumber) }))
    .sort((a, b) => a.positionNumber - b.positionNumber)
}

export async function submitSoloResult(slot: RoundSlot, teamId: string, level: 'level_1' | 'level_2' | 'level_3') {
  const { error } = await client().rpc('award_position_result', {
    p_team_id: teamId,
    p_round_id: slot.roundId,
    p_position_id: slot.positionId,
    p_level: level,
  })
  if (error) throw error
}

export async function submitDuelResult(slot: RoundSlot, outcome: 'a_win' | 'b_win' | 'draw') {
  const [teamA, teamB] = slot.teams
  if (!teamA || !teamB) throw new Error('Duel needs two teams')
  const { error } = await client().rpc('record_duel_result', {
    p_round_id: slot.roundId,
    p_position_id: slot.positionId,
    p_team_a: teamA.id,
    p_team_b: teamB.id,
    p_outcome: outcome,
  })
  if (error) throw error
}

export async function advanceRound(eventId: string): Promise<number> {
  const { data, error } = await client().rpc('advance_round', { p_event_id: eventId })
  if (error) throw error
  return data as number
}

export async function fetchTycoon(teamId: string): Promise<TycoonSnapshot> {
  const db = client()
  const [tycoon, catalog, owned] = await Promise.all([
    db.from('tycoons').select('money, capacity, customer_count, is_open').eq('team_id', teamId).single(),
    db.from('shop_catalog').select('id, name, upgrade_costs').order('purchase_cost', { ascending: true }),
    db.from('team_shops').select('shop_id, level').eq('team_id', teamId),
  ])
  if (tycoon.error) throw tycoon.error
  if (catalog.error) throw catalog.error
  if (owned.error) throw owned.error
  return toSnapshot({ tycoon: tycoon.data, catalog: catalog.data ?? [], owned: owned.data ?? [] })
}

export async function purchaseOrUpgradeShop(shopId: string): Promise<number> {
  const { data, error } = await client().rpc('purchase_or_upgrade_shop', { p_shop_id: shopId })
  if (error) throw error
  return data as number
}

// Calls onChange for any change on the given tables; returns an unsubscribe function.
export function subscribeToTables(channelName: string, tables: string[], onChange: () => void): () => void {
  if (!supabase) return () => {}
  const db = supabase
  let channel = db.channel(channelName)
  for (const table of tables) {
    channel = channel.on('postgres_changes', { event: '*', schema: 'public', table }, onChange)
  }
  channel.subscribe()
  return () => {
    void db.removeChannel(channel)
  }
}
