import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { homeFor, useAuthStore } from './auth.store'

export function LoginPage() {
  const navigate = useNavigate()
  const role = useAuthStore((state) => state.role)
  const signIn = useAuthStore((state) => state.signIn)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (role) navigate(homeFor(role), { replace: true })
  }, [role, navigate])

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(await signIn(email, password))
    setBusy(false)
  }

  return (
    <main className="form-page">
      <h1>Masuk</h1>
      <form className="stack" onSubmit={onSubmit}>
        <label>Email<input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        <label>Kata sandi<input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></label>
        <button type="submit" disabled={busy}>{busy ? 'Memproses…' : 'Masuk'}</button>
        {error && <p className="error" role="alert">{error}</p>}
      </form>
    </main>
  )
}
