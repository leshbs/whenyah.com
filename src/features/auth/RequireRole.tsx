import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuthStore, type AppRole } from './auth.store'

export function RequireRole({ allow }: { allow: AppRole[] }) {
  const status = useAuthStore((state) => state.status)
  const userId = useAuthStore((state) => state.userId)
  const role = useAuthStore((state) => state.role)
  const location = useLocation()

  // Without Supabase credentials the app stays usable with local demo data.
  if (!supabase) {
    return (
      <>
        <p className="notice">Mode demo: Supabase belum terhubung, data hanya contoh.</p>
        <Outlet />
      </>
    )
  }
  if (status === 'loading') return <main className="landing"><p>Memuat…</p></main>
  if (!userId) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (!role) {
    return (
      <main className="landing">
        <h1>Akun belum memiliki peran</h1>
        <p>Minta koordinator menambahkan akun ini ke daftar peran.</p>
      </main>
    )
  }
  if (!allow.includes(role)) {
    return (
      <main className="landing">
        <h1>Tidak punya akses</h1>
        <p>Halaman ini tidak tersedia untuk peran Anda.</p>
      </main>
    )
  }
  return <Outlet />
}
