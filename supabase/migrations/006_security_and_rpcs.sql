-- 006: server-side authorization for the economy, duel scoring, round control,
-- leaderboard view, realtime publication, and an idempotent assignment backfill.
-- Fixes: F001 (assignments were never seeded when seed.sql ran after 004) and
-- F002 (award_position_result could be called by any logged-in user).

-- Role helper -----------------------------------------------------------------
create or replace function public.current_app_role()
returns public.app_role
language sql stable security definer set search_path = ''
as $$ select role from public.user_roles where user_id = auth.uid() $$;

revoke all on function public.current_app_role() from public, anon;
grant execute on function public.current_app_role() to authenticated;

-- Internal helpers (not callable from the API) ---------------------------------
create or replace function public._apply_award(
  p_team_id uuid, p_round_id uuid, p_position_id uuid, p_level public.result_level
)
returns void
language plpgsql security definer set search_path = ''
as $$
declare v_money integer; v_customers integer;
begin
  select case p_level when 'level_1' then 30 when 'level_2' then 50 when 'level_3' then 70
                      when 'win' then 50 when 'draw' then 35 else 20 end,
         case p_level when 'level_1' then 4 when 'level_2' then 6 when 'level_3' then 8
                      when 'win' then 6 when 'draw' then 4 else 3 end
    into v_money, v_customers;

  begin
    insert into public.position_results(round_id, position_id, team_id, level, money_award, customer_award)
    values (p_round_id, p_position_id, p_team_id, p_level, v_money, v_customers);
  exception when unique_violation then
    raise exception 'result already recorded for this team, position and round' using errcode = 'P0001';
  end;

  update public.tycoons
     set money = money + v_money,
         customer_count = least(capacity, customer_count + v_customers),
         updated_at = now()
   where team_id = p_team_id;

  insert into public.economy_transactions(team_id, kind, amount, metadata)
  values (p_team_id, 'position_award', v_money,
          jsonb_build_object('customers', v_customers, 'round_id', p_round_id,
                             'position_id', p_position_id, 'level', p_level));
end; $$;

revoke all on function public._apply_award(uuid, uuid, uuid, public.result_level)
  from public, anon, authenticated;

create or replace function public._assert_can_record(p_round_id uuid, p_position_id uuid, p_team_id uuid)
returns public.position_kind
language plpgsql security definer set search_path = ''
as $$
declare
  v_role public.app_role;
  v_kind public.position_kind;
  v_round_number integer;
  v_current_round integer;
  v_status text;
begin
  v_role := public.current_app_role();
  if v_role is null or v_role not in ('staff', 'organizer') then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  select r.round_number, e.current_round, e.status
    into v_round_number, v_current_round, v_status
    from public.rounds r join public.events e on e.id = r.event_id
   where r.id = p_round_id;
  if not found then
    raise exception 'unknown round' using errcode = '22023';
  end if;

  -- Staff may only record results for the active round; organizers may correct any round.
  if v_role = 'staff' and (v_status <> 'running' or v_round_number <> v_current_round) then
    raise exception 'round is not active' using errcode = 'P0001';
  end if;

  if not exists (
    select 1 from public.round_assignments
     where round_id = p_round_id and position_id = p_position_id and team_id = p_team_id
  ) then
    raise exception 'team is not assigned to this position in this round' using errcode = 'P0001';
  end if;

  select kind into v_kind from public.positions where id = p_position_id;
  return v_kind;
end; $$;

revoke all on function public._assert_can_record(uuid, uuid, uuid) from public, anon, authenticated;

-- Public RPCs -----------------------------------------------------------------
-- Same signature as 003, so this replaces the insecure version in place.
create or replace function public.award_position_result(
  p_team_id uuid, p_round_id uuid, p_position_id uuid, p_level public.result_level
)
returns void
language plpgsql security definer set search_path = ''
as $$
declare v_kind public.position_kind;
begin
  v_kind := public._assert_can_record(p_round_id, p_position_id, p_team_id);
  if v_kind <> 'solo' or p_level not in ('level_1', 'level_2', 'level_3') then
    raise exception 'solo positions accept level_1, level_2 or level_3 only' using errcode = '22023';
  end if;
  perform public._apply_award(p_team_id, p_round_id, p_position_id, p_level);
end; $$;

revoke all on function public.award_position_result(uuid, uuid, uuid, public.result_level) from public, anon;
grant execute on function public.award_position_result(uuid, uuid, uuid, public.result_level) to authenticated;

-- Scores both teams of a duel in one transaction. p_outcome: 'a_win' | 'b_win' | 'draw'.
create or replace function public.record_duel_result(
  p_round_id uuid, p_position_id uuid, p_team_a uuid, p_team_b uuid, p_outcome text
)
returns void
language plpgsql security definer set search_path = ''
as $$
declare v_kind public.position_kind;
begin
  if p_team_a = p_team_b then
    raise exception 'a duel needs two different teams' using errcode = '22023';
  end if;
  if p_outcome not in ('a_win', 'b_win', 'draw') then
    raise exception 'outcome must be a_win, b_win or draw' using errcode = '22023';
  end if;

  v_kind := public._assert_can_record(p_round_id, p_position_id, p_team_a);
  perform public._assert_can_record(p_round_id, p_position_id, p_team_b);
  if v_kind <> 'duel' then
    raise exception 'not a duel position' using errcode = '22023';
  end if;

  perform public._apply_award(p_team_a, p_round_id, p_position_id,
    (case p_outcome when 'a_win' then 'win' when 'b_win' then 'loss' else 'draw' end)::public.result_level);
  perform public._apply_award(p_team_b, p_round_id, p_position_id,
    (case p_outcome when 'b_win' then 'win' when 'a_win' then 'loss' else 'draw' end)::public.result_level);
end; $$;

revoke all on function public.record_duel_result(uuid, uuid, uuid, uuid, text) from public, anon;
grant execute on function public.record_duel_result(uuid, uuid, uuid, uuid, text) to authenticated;

-- Organizer round control. From round 15, one more call marks the event finished.
create or replace function public.advance_round(p_event_id uuid)
returns integer
language plpgsql security definer set search_path = ''
as $$
declare v_next integer;
begin
  if public.current_app_role() is distinct from 'organizer' then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  update public.events
     set current_round = least(current_round + 1, 15),
         status = case when current_round >= 15 then 'finished' else 'running' end
   where id = p_event_id
   returning current_round into v_next;
  if not found then
    raise exception 'unknown event' using errcode = '22023';
  end if;
  return v_next;
end; $$;

revoke all on function public.advance_round(uuid) from public, anon;
grant execute on function public.advance_round(uuid) to authenticated;

-- Leaderboard view (provisional ranking inputs; see docs/supabase-setup.md) --------
create or replace view public.leaderboard with (security_invoker = true) as
select t.id as team_id,
       t.event_id,
       t.team_number,
       t.name,
       ty.money,
       ty.customer_count,
       coalesce(tx.earned_total, 0)::integer as earned_total,
       coalesce(tx.results_count, 0)::integer as results_count
  from public.teams t
  join public.tycoons ty on ty.team_id = t.id
  left join (
    select team_id,
           sum(amount) filter (where amount > 0) as earned_total,
           count(*) filter (where kind = 'position_award') as results_count
      from public.economy_transactions
     group by team_id
  ) tx on tx.team_id = t.id;

revoke all on public.leaderboard from anon;
grant select on public.leaderboard to authenticated;

-- Realtime ----------------------------------------------------------------------
do $$
declare t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['tycoons', 'events', 'economy_transactions', 'position_results'] loop
      begin
        execute format('alter publication supabase_realtime add table public.%I', t);
      exception when duplicate_object then null;
      end;
    end loop;
  end if;
end $$;

-- Idempotent backfill of round assignments (same formula as 004 / schedule.ts) ----
insert into public.round_assignments(round_id, position_id, team_id)
select r.id, p.id, t.id
  from public.rounds r
 cross join generate_series(0, 14) as slot(slot_number)
  join public.positions p on p.event_id = r.event_id and p.position_number = case
    when slot.slot_number <= 8 then slot.slot_number + 1
    when slot.slot_number in (9, 12) then 10
    when slot.slot_number in (10, 14) then 11
    else 12
  end
  join public.teams t on t.event_id = r.event_id
   and t.team_number = (((slot.slot_number - 7 * (r.round_number - 1)) % 15 + 15) % 15) + 1
on conflict (round_id, team_id) do nothing;
