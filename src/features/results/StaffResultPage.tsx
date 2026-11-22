import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../auth/auth.store'
import { describeRpcError } from '../rally/rally.errors'
import { fetchEvent, fetchRoundSlots, submitDuelResult, submitSoloResult, subscribeToTables } from '../rally/rally.service'
import type { EventState, RoundSlot } from '../rally/rally.types'

type SoloLevel = 'level_1' | 'level_2' | 'level_3'
type DuelOutcome = 'a_win' | 'b_win' | 'draw'

export function StaffResultPage() {
  if (!supabase) return <DemoStaffForm />
  return <LiveStaffForm />
}

function LiveStaffForm() {
  const [event, setEvent] = useState<EventState | null>(null)
  const [slots, setSlots] = useState<RoundSlot[]>([])
  const role = useAuthStore((state) => state.role)
  const ownPositionId = useAuthStore((state) => state.positionId)
  const [pickedPositionId, setPositionId] = useState('')
  const [teamId, setTeamId] = useState('')
  const [level, setLevel] = useState<SoloLevel>('level_2')
  const [outcome, setOutcome] = useState<DuelOutcome>('a_win')
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const current = await fetchEvent()
      setEvent(current)
      if (current && current.status === 'running') setSlots(await fetchRoundSlots(current.id, current.currentRound))
      else setSlots([])
    } catch {
      setMessage({ kind: 'error', text: 'Gagal memuat data ronde.' })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
    return subscribeToTables('staff-results', ['events', 'position_results'], () => void load())
  }, [load])

  // Staff are bound to one post; organizers can open any post (for corrections).
  const isStaff = role === 'staff'
  const visibleSlots = isStaff ? slots.filter((item) => item.positionId === ownPositionId) : slots
  const positionId = isStaff ? (ownPositionId ?? '') : pickedPositionId
  const slot = visibleSlots.find((item) => item.positionId === positionId)
  const onlineLocked = isStaff && slot?.delivery === 'online'
  const target = slot?.kind === 'solo' ? slot.teams.find((team) => team.id === teamId) ?? slot.teams[0] : undefined
  const alreadyDone = slot ? slot.teams.every((team) => team.level !== null) : false

  function choosePosition(id: string) {
    setPositionId(id)
    setTeamId('')
    setConfirming(false)
    setMessage(null)
  }

  async function confirm() {
    if (!slot) return
    if (!confirming) { setConfirming(true); return }
    setBusy(true)
    try {
      if (slot.kind === 'solo' && target) await submitSoloResult(slot, target.id, level)
      else await submitDuelResult(slot, outcome)
      setMessage({ kind: 'success', text: 'Hasil berhasil dicatat.' })
      await load()
    } catch (error) {
      setMessage({ kind: 'error', text: describeRpcError(error instanceof Error ? error.message : (error as { message?: string })?.message) })
    } finally {
      setBusy(false)
      setConfirming(false)
    }
  }

  if (loading) return <main className="form-page"><p>Memuat…</p></main>
  if (isStaff && !ownPositionId) {
    return <main className="form-page"><h1>Input Hasil Pos</h1><p className="error">Akun staf ini belum ditugaskan ke pos. Hubungi koordinator.</p></main>
  }
  if (!event || event.status !== 'running') {
    return <main className="form-page"><h1>Input Hasil Pos</h1><p>Ronde belum dimulai. Tunggu koordinator memulai acara.</p></main>
  }

  const [teamA, teamB] = slot?.teams ?? []
  return (
    <main className="form-page">
      <h1>Input Hasil Pos</h1>
      <p>Ronde {event.currentRound}</p>
      {isStaff && slot && <p><strong>{slot.positionName}</strong> ({slot.kind === 'solo' ? 'solo' : 'duel'}{slot.delivery === 'online' ? ', online' : ''})</p>}
      {isStaff && !slot && <p>Pos Anda tidak aktif pada ronde ini.</p>}
      {!isStaff && <label>Pos
        <select value={positionId} onChange={(e) => choosePosition(e.target.value)}>
          <option value="">Pilih pos…</option>
          {visibleSlots.map((item) => (
            <option key={item.positionId} value={item.positionId}>
              {item.positionName} ({item.kind === 'solo' ? 'solo' : 'duel'}{item.delivery === 'online' ? ', online' : ''}){item.teams.every((t) => t.level) ? ' ✓' : ''}
            </option>
          ))}
        </select>
      </label>}

      {onlineLocked && <p>Pos online: hadiah diberikan otomatis oleh sistem, tidak perlu input manual.</p>}

      {!onlineLocked && slot?.kind === 'solo' && target && (
        <>
          <p>{target.name}{target.level ? ` · tercatat: ${target.level.replace('level_', 'Level ')}` : ''}</p>
          <label>Hasil
            <select value={level} onChange={(e) => { setLevel(e.target.value as SoloLevel); setConfirming(false) }}>
              <option value="level_1">Level 1</option>
              <option value="level_2">Level 2</option>
              <option value="level_3">Level 3</option>
            </select>
          </label>
        </>
      )}

      {!onlineLocked && slot?.kind === 'duel' && teamA && teamB && (
        <label>Hasil duel
          <select value={outcome} onChange={(e) => { setOutcome(e.target.value as DuelOutcome); setConfirming(false) }}>
            <option value="a_win">{teamA.name} menang</option>
            <option value="b_win">{teamB.name} menang</option>
            <option value="draw">Seri</option>
          </select>
        </label>
      )}

      {slot && !onlineLocked && (
        <button type="button" onClick={() => void confirm()} disabled={busy || alreadyDone}>
          {alreadyDone ? 'Sudah tercatat' : confirming ? 'Yakin? Tidak bisa diubah. Ketuk lagi' : 'Konfirmasi hasil'}
        </button>
      )}
      {message && <p className={message.kind === 'success' ? 'success' : 'error'} role={message.kind === 'error' ? 'alert' : 'status'}>{message.text}</p>}
    </main>
  )
}

function DemoStaffForm() {
  const [saved, setSaved] = useState(false)
  return (
    <main className="form-page">
      <h1>Input Hasil Pos</h1>
      <p>Ronde 1 · Pos 1 · Solo (contoh)</p>
      <label>Tim<select defaultValue="1">{Array.from({ length: 15 }, (_, i) => <option key={i + 1}>Tim {i + 1}</option>)}</select></label>
      <label>Hasil<select defaultValue="2"><option value="1">Level 1</option><option value="2">Level 2</option><option value="3">Level 3</option></select></label>
      <button type="button" onClick={() => setSaved(true)}>Konfirmasi hasil</button>
      {saved && <p className="success">Hadiah berhasil dicatat (demo).</p>}
    </main>
  )
}
