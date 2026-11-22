import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../auth/auth.store'
import { describeRpcError } from '../rally/rally.errors'
import { fetchTycoon, purchaseOrUpgradeShop, subscribeToTables } from '../rally/rally.service'
import { PhaserGame } from './game/PhaserGame'
import { useTycoonStore } from './tycoon.store'

export function TycoonPage() {
  const state = useTycoonStore()
  const teamId = useAuthStore((auth) => auth.teamId)
  const [busyShop, setBusyShop] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!supabase || !teamId) return
    try {
      useTycoonStore.getState().replaceFromServer(await fetchTycoon(teamId))
      setError(null)
    } catch {
      setError('Gagal memuat data toko.')
    }
  }, [teamId])

  useEffect(() => {
    void load()
    if (!teamId) return
    return subscribeToTables(`tycoon-${teamId}`, ['tycoons', 'team_shops'], () => void load())
  }, [load, teamId])

  async function buy(shopId: string) {
    setBusyShop(shopId)
    try {
      await purchaseOrUpgradeShop(shopId)
      await load()
    } catch (e) {
      setError(describeRpcError(e instanceof Error ? e.message : (e as { message?: string })?.message))
    } finally {
      setBusyShop(null)
    }
  }

  const live = Boolean(supabase && teamId)
  return (
    <main className="tycoon-page">
      <header className="tycoon-hud">
        <div><span>Money</span><strong>Rp {state.money.toLocaleString('id-ID')}</strong></div>
        <div><span>Customer</span><strong>{state.customers}/{state.capacity}</strong></div>
        <div><span>Status</span><strong>{state.isOpen ? 'BUKA' : 'TUTUP'}</strong></div>
      </header>
      <PhaserGame />
      {error && <p className="error" role="alert">{error}</p>}
      <section className="shop-panel" aria-label="Toko dan upgrade">
        {state.shops.map((shop) => (
          <article key={shop.id}>
            <h2>{shop.name}</h2>
            <p>{shop.owned ? `Level ${shop.level}` : 'Belum dimiliki'}</p>
            <button
              type="button"
              disabled={!live || shop.maxed || busyShop !== null || state.money < shop.upgradeCost}
              onClick={() => void buy(shop.id)}
            >
              {shop.maxed ? 'Level maksimum' : shop.owned ? `Upgrade Rp ${shop.upgradeCost}` : `Beli Rp ${shop.upgradeCost}`}
            </button>
          </article>
        ))}
      </section>
    </main>
  )
}
