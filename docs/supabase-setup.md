# Supabase setup (Rally Tycoon)

Language note: UI text is Indonesian; this guide is English.

## 1. Connect the web app
1. Supabase dashboard → Project Settings → API. Copy the project URL and the **publishable** (anon) key.
2. Copy `.env.example` to `.env`:
   ```
   VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
   ```
3. Never put the `service_role` / secret key in the web app or in git.

## 2. Apply the database
Run, in order, in the SQL Editor (or with the Supabase CLI): `supabase/migrations/001` … `007`, then `supabase/seed.sql`.
- Already ran 001–005 and the seed earlier? Run `006` and `007` once, in order. Both are safe to re-run; 006 backfills the missing round assignments.
- `seed.sql` now ends with the assignments insert, so a fresh reset seeds them correctly.
- Check: `select count(*) from round_assignments;` should be **225** (15 rounds × 15 teams).

## 3. Auth users
1. Authentication → Providers → Email: turn **off** "Confirm email" (so simple team accounts work).
2. Authentication → Users → Add user (tick "Auto Confirm User"):
   - 15 teams: `tim01@rally.local` … `tim15@rally.local`
   - staff, one account per post: `pos01@rally.local` … `pos12@rally.local` (offline and online posts alike)
   - organizer: one real email
3. Map accounts to roles in the SQL Editor:
   ```sql
   insert into public.user_roles(user_id, role, team_id)
   select u.id, 'team', t.id
     from public.teams t
     join auth.users u on u.email = 'tim' || lpad(t.team_number::text, 2, '0') || '@rally.local'
    where t.event_id = '00000000-0000-0000-0000-000000000001'
   on conflict (user_id) do update set role = 'team', team_id = excluded.team_id;

   -- each staff account is bound to the post with the same number (pos07 -> Pos 7)
   insert into public.user_roles(user_id, role, position_id)
   select u.id, 'staff', p.id
     from public.positions p
     join auth.users u on u.email = 'pos' || lpad(p.position_number::text, 2, '0') || '@rally.local'
    where p.event_id = '00000000-0000-0000-0000-000000000001'
   on conflict (user_id) do update set role = 'staff', team_id = null, position_id = excluded.position_id;

   insert into public.user_roles(user_id, role)
   select id, 'organizer' from auth.users where email = 'ORGANIZER_EMAIL'
   on conflict (user_id) do update set role = 'organizer', team_id = null, position_id = null;
   ```

## 4. Realtime
Migrations 006/007 add `tycoons`, `events`, `economy_transactions`, `position_results` and `team_shops` to the `supabase_realtime` publication. Confirm under Database → Replication.

## 5. How the rules are enforced
- Only `staff`/`organizer` accounts can record results. **Each staff account is bound to one post** (`user_roles.position_id`); staff can only record for that post, for the **active** round, for teams assigned to it, once per team/position/round. Organizers can correct any post and round.
- **Offline vs online posts** (`positions.delivery`, default `offline`). Offline: staff hand over the prize and record it. Online: the web minigame awards automatically; staff are rejected. Online results are written by the server-only function `award_online_result` (service role / Edge Function, never callable from a browser). Mark online posts with:
  ```sql
  update public.positions set delivery = 'online'
   where event_id = '00000000-0000-0000-0000-000000000001' and position_number in (/* online post numbers */);
  ```
- **Capacity full:** customers above `capacity` are voided. The transaction metadata records `customers`, `customers_added` and `customers_voided`.
- **Ranking:** Total Earned = balance + assets, where assets = what was paid to reach each shop's current level (`leaderboard` view columns `asset_value`, `total_earned`). Upgrades therefore do not lose points.
- Duel results score both teams in one transaction (`record_duel_result`).
- Only `organizer` can start the next round (`advance_round`).
- Teams buy/upgrade shops with `purchase_or_upgrade_shop` (own team only, event must be running, enough money, max level 3).
- Browsers have no write access to the economy tables; only these functions change money, customers and shop levels.

## 6. Open decisions
- Income timing: how and when shop income is paid is not decided, so passive income is not implemented.
- Which post numbers are online, and how the online minigames report their result to `award_online_result`.
- What "open/close" means for a shop (effect on customers or income); no open/close function yet.
- No undo for a wrong result yet (organizers can only record, not reverse).
- `advance_round` does not require the previous round to be complete (the organizer page warns instead).
