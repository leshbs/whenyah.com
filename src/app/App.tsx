import { useEffect } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../features/auth/auth.store'

export function App() {
  const init = useAuthStore((state) => state.init)
  const userId = useAuthStore((state) => state.userId)
  const role = useAuthStore((state) => state.role)
  const signOut = useAuthStore((state) => state.signOut)

  useEffect(() => init(), [init])

  // Demo mode (no Supabase) shows every link; otherwise links follow the signed-in role.
  const show = (roles: string[]) => !supabase || (role !== null && roles.includes(role))

  return (
    <div className="app-shell">
      <nav className="top-nav">
        <NavLink to="/">Rally Tycoon</NavLink>
        {show(['team']) && <NavLink to="/team">Tim</NavLink>}
        {show(['staff', 'organizer']) && <NavLink to="/staff">Petugas</NavLink>}
        {show(['organizer']) && <NavLink to="/organizer">Koordinator</NavLink>}
        {show(['team', 'staff', 'organizer']) && <NavLink to="/leaderboard">Peringkat</NavLink>}
        {supabase && (userId
          ? <button type="button" onClick={() => void signOut()}>Keluar</button>
          : <NavLink to="/login">Masuk</NavLink>)}
      </nav>
      <Outlet />
    </div>
  )
}
