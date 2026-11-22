import { create } from 'zustand'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'

export type AppRole = 'team' | 'staff' | 'organizer'

type AuthStore = {
  status: 'loading' | 'ready'
  userId: string | null
  email: string | null
  role: AppRole | null
  teamId: string | null
  positionId: string | null
  init: () => () => void
  signIn: (email: string, password: string) => Promise<string | null>
  signOut: () => Promise<void>
}

export function homeFor(role: AppRole | null): string {
  if (role === 'staff') return '/staff'
  if (role === 'organizer') return '/organizer'
  if (role === 'team') return '/team'
  return '/'
}

export const useAuthStore = create<AuthStore>((set) => {
  async function applySession(session: Session | null) {
    if (!supabase || !session) {
      set({ status: 'ready', userId: null, email: null, role: null, teamId: null, positionId: null })
      return
    }
    const { data } = await supabase
      .from('user_roles')
      .select('role, team_id, position_id')
      .eq('user_id', session.user.id)
      .maybeSingle()
    set({
      status: 'ready',
      userId: session.user.id,
      email: session.user.email ?? null,
      role: (data?.role as AppRole | undefined) ?? null,
      teamId: (data?.team_id as string | null | undefined) ?? null,
      positionId: (data?.position_id as string | null | undefined) ?? null,
    })
  }

  return {
    status: 'loading',
    userId: null,
    email: null,
    role: null,
    teamId: null,
    positionId: null,
    init: () => {
      if (!supabase) {
        set({ status: 'ready' })
        return () => {}
      }
      // INITIAL_SESSION fires on subscribe. Queries are deferred out of the callback,
      // because awaiting other Supabase calls inside it can deadlock the auth client.
      const { data } = supabase.auth.onAuthStateChange((_event, session) => {
        setTimeout(() => void applySession(session), 0)
      })
      return () => data.subscription.unsubscribe()
    },
    signIn: async (email, password) => {
      if (!supabase) return 'Supabase belum terhubung.'
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      return error ? 'Email atau kata sandi salah.' : null
    },
    signOut: async () => {
      await supabase?.auth.signOut()
    },
  }
})
