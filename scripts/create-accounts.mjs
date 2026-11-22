import { createClient } from '@supabase/supabase-js'
import { randomBytes } from 'node:crypto'
import { writeFileSync } from 'node:fs'

const EVENT_ID = '00000000-0000-0000-0000-000000000001'
const url = process.env.VITE_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const organizerEmail = process.env.ORGANIZER_EMAIL

if (!url || !serviceKey || !organizerEmail) {
  throw new Error('Set VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and ORGANIZER_EMAIL')
}

const db = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
const pad = (n) => String(n).padStart(2, '0')

const accounts = [
  ...Array.from({ length: 15 }, (_, i) => ({ email: `tim${pad(i + 1)}@rally.local`, role: 'team', teamNumber: i + 1 })),
  ...Array.from({ length: 12 }, (_, i) => ({ email: `pos${pad(i + 1)}@rally.local`, role: 'staff', positionNumber: i + 1 })),
  { email: organizerEmail, role: 'organizer' },
]

const [teamsResult, positionsResult] = await Promise.all([
  db.from('teams').select('id, team_number').eq('event_id', EVENT_ID),
  db.from('positions').select('id, position_number').eq('event_id', EVENT_ID),
])
if (teamsResult.error) throw teamsResult.error
if (positionsResult.error) throw positionsResult.error

const existing = new Map()
for (let page = 1; ; page++) {
  const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 })
  if (error) throw error
  for (const user of data.users) existing.set(user.email?.toLowerCase(), user.id)
  if (data.users.length < 200) break
}

const csv = ['email,role,password']
for (const account of accounts) {
  const password = randomBytes(9).toString('base64url')
  let userId = existing.get(account.email.toLowerCase())

  if (userId) {
    const { error } = await db.auth.admin.updateUserById(userId, { password, email_confirm: true })
    if (error) throw error
  } else {
    const { data, error } = await db.auth.admin.createUser({ email: account.email, password, email_confirm: true })
    if (error) throw error
    userId = data.user.id
  }

  const row = { user_id: userId, role: account.role, team_id: null, position_id: null }
  if (account.role === 'team') {
    row.team_id = teamsResult.data.find((t) => t.team_number === account.teamNumber)?.id
    if (!row.team_id) throw new Error(`Team ${account.teamNumber} not found`)
  }
  if (account.role === 'staff') {
    row.position_id = positionsResult.data.find((p) => p.position_number === account.positionNumber)?.id
    if (!row.position_id) throw new Error(`Position ${account.positionNumber} not found`)
  }

  const { error } = await db.from('user_roles').upsert(row, { onConflict: 'user_id' })
  if (error) throw error
  csv.push(`${account.email},${account.role},${password}`)
  console.log(`ok ${account.role} ${account.email}`)
}

writeFileSync('credentials.local.csv', csv.join('\n') + '\n')
console.log('Selesai. Kredensial ditulis ke credentials.local.csv (jangan di-commit).')
