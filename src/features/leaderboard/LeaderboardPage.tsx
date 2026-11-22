import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { demoLeaderboard, rankLeaderboard } from '../rally/leaderboard'
import { fetchLeaderboard, subscribeToTables } from '../rally/rally.service'
import type { LeaderboardRow } from '../rally/rally.types'

export function LeaderboardPage() {
  const [rows, setRows] = useState<LeaderboardRow[]>(() => (supabase ? [] : demoLeaderboard()))
  const [loading, setLoading] = useState(Boolean(supabase))
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!supabase) return
    let active = true
    let timer: ReturnType<typeof setTimeout> | undefined

    const load = async () => {
      try {
        const data = await fetchLeaderboard()
        if (active) { setRows(data); setError(null) }
      } catch {
        if (active) setError('Gagal memuat peringkat. Mencoba lagi saat ada pembaruan.')
      } finally {
        if (active) setLoading(false)
      }
    }
    void load()
    const unsubscribe = subscribeToTables('leaderboard', ['tycoons', 'team_shops', 'economy_transactions'], () => {
      clearTimeout(timer)
      timer = setTimeout(() => void load(), 250)
    })
    return () => { active = false; clearTimeout(timer); unsubscribe() }
  }, [])

  const ranked = useMemo(() => rankLeaderboard(rows), [rows])

  return (
    <main className="table-page">
      <h1>Peringkat Live</h1>
      {error && <p className="error" role="alert">{error}</p>}
      {loading ? <p>Memuat…</p> : (
        <table>
          <thead><tr><th>#</th><th>Tim</th><th>Total Earned</th><th>Saldo</th><th>Aset</th><th>Pelanggan</th></tr></thead>
          <tbody>
            {ranked.map((team) => (
              <tr key={team.teamId}>
                <td>{team.rank}</td>
                <td>{team.name}</td>
                <td>Rp {team.totalEarned.toLocaleString('id-ID')}</td>
                <td>Rp {team.money.toLocaleString('id-ID')}</td>
                <td>Rp {team.assetValue.toLocaleString('id-ID')}</td>
                <td>{team.customerCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  )
}
