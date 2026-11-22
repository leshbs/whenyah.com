import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { describeRpcError } from '../rally/rally.errors'
import { advanceRound, fetchEvent, fetchRoundSlots, subscribeToTables } from '../rally/rally.service'
import type { EventState, RoundSlot } from '../rally/rally.types'
import { buildSchedule } from '../rally/schedule'

export function OrganizerDashboardPage() {
  if (!supabase) return <DemoDashboard />
  return <LiveDashboard />
}

function LiveDashboard() {
  const [event, setEvent] = useState<EventState | null>(null)
  const [slots, setSlots] = useState<RoundSlot[]>([])
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const current = await fetchEvent()
      setEvent(current)
      if (current) setSlots(await fetchRoundSlots(current.id, Math.max(current.currentRound, 1)))
      setError(null)
    } catch {
      setError('Gagal memuat data acara.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
    return subscribeToTables('organizer', ['events', 'position_results'], () => void load())
  }, [load])

  if (loading) return <main className="table-page"><p>Memuat…</p></main>
  if (!event) return <main className="table-page"><h1>Kontrol Acara</h1><p className="error">Event belum ada. Jalankan supabase/seed.sql.</p></main>

  const expected = slots.reduce((sum, slot) => sum + slot.teams.length, 0)
  const recorded = slots.reduce((sum, slot) => sum + slot.teams.filter((team) => team.level).length, 0)
  const finished = event.status === 'finished'
  const label = finished ? 'Acara selesai' : event.currentRound === 0 ? 'Mulai ronde 1' : event.currentRound >= 15 ? 'Akhiri acara' : `Mulai ronde ${event.currentRound + 1}`

  async function next() {
    if (!event) return
    const missing = event.currentRound > 0 ? expected - recorded : 0
    const warning = missing > 0 ? `Masih ada ${missing} hasil belum tercatat. Lanjutkan?` : `${label}?`
    if (!window.confirm(warning)) return
    setBusy(true)
    try {
      await advanceRound(event.id)
      await load()
    } catch (e) {
      setError(describeRpcError(e instanceof Error ? e.message : (e as { message?: string })?.message))
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="table-page">
      <h1>Kontrol Acara</h1>
      <p>{event.name} · status: {event.status} · ronde {event.currentRound} dari 15</p>
      <button type="button" onClick={() => void next()} disabled={busy || finished}>{label}</button>
      {error && <p className="error" role="alert">{error}</p>}
      <h2>Penugasan ronde {Math.max(event.currentRound, 1)} ({recorded}/{expected} hasil tercatat)</h2>
      {slots.length === 0 && <p className="error">Penugasan kosong. Jalankan ulang supabase/seed.sql atau migration 006.</p>}
      <ul>
        {slots.map((slot) => (
          <li key={slot.positionId}>
            {slot.positionName}: {slot.teams.map((team) => `${team.name}${team.level ? ' ✓' : ''}`).join(' vs ')}
          </li>
        ))}
      </ul>
    </main>
  )
}

function DemoDashboard() {
  const schedule = buildSchedule()
  return (
    <main className="table-page">
      <h1>Kontrol Acara</h1>
      <p>Ronde 1 dari 15 · 12 pos aktif · 15 tim (contoh).</p>
      <button type="button" disabled>Mulai ronde berikutnya</button>
      <h2>Penugasan ronde 1</h2>
      <ul>{schedule[0]?.solo.map((item) => <li key={item.positionId}>Pos {item.positionId}: Tim {item.teamId}</li>)}</ul>
    </main>
  )
}
