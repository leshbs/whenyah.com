-- 007: organizer rules confirmed on 2026-11-22.
--  * Every staff account is bound to exactly one post (offline or online).
--  * Offline posts: staff hand over the prize, so staff record the result.
--    Online posts: the minigame is linked to the web and awards automatically (server only).
--  * Customers above capacity are voided (and the voided count is logged).
--  * Ranking score "Total Earned" = balance + assets (value of shop levels owned).
--  * Teams can buy and upgrade shops (server-authoritative).
-- Safe to re-run.

-- Schema ----------------------------------------------------------------------
alter table public.positions
  add column if not exists delivery text not null default 'offline';
do $$ begin
  alter table public.positions
    add constraint positions_delivery_check check (delivery in ('offline', 'online'));
exception when duplicate_object then null; end $$;

alter table public.user_roles
  add column if not exists position_id uuid references public.positions(id) on delete set null;
do $$ begin
  alter table public.user_roles
    add constraint user_roles_staff_needs_position
    check (role <> 'staff' or position_id is not null) not valid;
exception when duplicate_object then null; end $$;

-- Award helper: voids customers above capacity and logs how many -----------------
create or replace function public._apply_award(
  p_team_id uuid, p_round_id uuid, p_position_id uuid, p_level public.result_level
)
returns void
language plpgsql security definer set search_path = ''
as $$
declare v_money integer; v_customers integer; v_room integer; v_added integer;
begin
  select case p_level when 'level_1' then 30 when 'level_2' then 50 when 'level_3' then 70
                      when 'win' then 50 when 'draw' then 35 else 20 end,
         case p_level when 'level_1' then 4 when 'level_2' then 6 when 'level_3' then 8
                      when 'win' then 6 when 'draw' then 4 else 3 end
    into v_money, v_customers;

  select greatest(capacity - customer_count, 0) into v_room
    from public.tycoons where team_id = p_team_id for update;
  if not found then
    raise exception 'team has no tycoon' using errcode = '22023';
  end if;
  v_added := least(v_customers, v_room);

  begin
    insert into public.position_results(round_id, position_id, team_id, level, money_award, customer_award)
    values (p_round_id, p_position_id, p_team_id, p_level, v_money, v_customers);
  exception when unique_violation then
    raise exception 'result already recorded for this team, position and round' using errcode = 'P0001';
  end;

  update public.tycoons
     set money = money + v_money,
         customer_count = customer_count + v_added,
         updated_at = now()
   where team_id = p_team_id;

  insert into public.economy_transactions(team_id, kind, amount, metadata)
  values (p_team_id, 'position_award', v_money,
          jsonb_build_object('customers', v_customers, 'customers_added', v_added,
                             'customers_voided', v_customers - v_added,
                             'round_id', p_round_id, 'position_id', p_position_id, 'level', p_level));
end; $$;

revoke all on function public._apply_award(uuid, uuid, uuid, public.result_level)
  from public, anon, authenticated;

-- Authorization: staff are bound to their own post, offline posts only -------------
create or replace function public._assert_can_record(p_round_id uuid, p_position_id uuid, p_team_id uuid)
returns public.position_kind
language plpgsql security definer set search_path = ''
as $$
declare
  v_role public.app_role;
  v_staff_position uuid;
  v_kind public.position_kind;
  v_delivery text;
  v_round_number integer;
  v_current_round integer;
  v_status text;
begin
  select role, position_id into v_role, v_staff_position
    from public.user_roles where user_id = auth.uid();
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

  select kind, delivery into v_kind, v_delivery from public.positions where id = p_position_id;
  if not found then
    raise exception 'unknown position' using errcode = '22023';
  end if;

  if v_role = 'staff' then
    if v_staff_position is distinct from p_position_id then
      raise exception 'staff post mismatch' using errcode = '42501';
    end if;
    if v_delivery <> 'offline' then
      raise exception 'online position is awarded automatically' using errcode = 'P0001';
    end if;
    -- Staff may only record results for the active round; organizers may correct any round.
    if v_status <> 'running' or v_round_number <> v_current_round then
      raise exception 'round is not active' using errcode = 'P0001';
    end if;
  end if;

  if not exists (
    select 1 from public.round_assignments
     where round_id = p_round_id and position_id = p_position_id and team_id = p_team_id
  ) then
    raise exception 'team is not assigned to this position in this round' using errcode = 'P0001';
  end if;

  return v_kind;
end; $$;

revoke all on function public._assert_can_record(uuid, uuid, uuid) from public, anon, authenticated;

-- Online posts: the web minigame backend (service role / Edge Function) awards the result.
-- Never callable from a browser session, so a player cannot award themselves.
create or replace function public.award_online_result(
  p_team_id uuid, p_round_id uuid, p_position_id uuid, p_level public.result_level
)
returns void
language plpgsql security definer set search_path = ''
as $$
declare v_kind public.position_kind; v_delivery text; v_round_number integer; v_current_round integer; v_status text;
begin
  select kind, delivery into v_kind, v_delivery from public.positions where id = p_position_id;
  if not found or v_delivery <> 'online' then
    raise exception 'not an online position' using errcode = '22023';
  end if;
  if v_kind <> 'solo' or p_level not in ('level_1', 'level_2', 'level_3') then
    raise exception 'solo positions accept level_1, level_2 or level_3 only' using errcode = '22023';
  end if;

  select r.round_number, e.current_round, e.status
    into v_round_number, v_current_round, v_status
    from public.rounds r join public.events e on e.id = r.event_id
   where r.id = p_round_id;
  if not found then
    raise exception 'unknown round' using errcode = '22023';
  end if;
  if v_status <> 'running' or v_round_number <> v_current_round then
    raise exception 'round is not active' using errcode = 'P0001';
  end if;

  if not exists (
    select 1 from public.round_assignments
     where round_id = p_round_id and position_id = p_position_id and team_id = p_team_id
  ) then
    raise exception 'team is not assigned to this position in this round' using errcode = 'P0001';
  end if;

  perform public._apply_award(p_team_id, p_round_id, p_position_id, p_level);
end; $$;

revoke all on function public.award_online_result(uuid, uuid, uuid, public.result_level)
  from public, anon, authenticated;
grant execute on function public.award_online_result(uuid, uuid, uuid, public.result_level) to service_role;

-- Shops: buy (level 0 to 1) or upgrade (level n to n+1) for the caller's own team ------
-- Cost to reach level n is shop_catalog.upgrade_costs[n] (1-based), e.g. arcade: 120, 150, 210.
create or replace function public.purchase_or_upgrade_shop(p_shop_id text)
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_role public.app_role; v_team uuid; v_status text;
  v_costs integer[]; v_level integer; v_cost integer; v_money integer;
begin
  select role, team_id into v_role, v_team from public.user_roles where user_id = auth.uid();
  if v_role is distinct from 'team' or v_team is null then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  select e.status into v_status
    from public.teams t join public.events e on e.id = t.event_id where t.id = v_team;
  if v_status is distinct from 'running' then
    raise exception 'event is not running' using errcode = 'P0001';
  end if;

  select upgrade_costs into v_costs from public.shop_catalog where id = p_shop_id;
  if not found then
    raise exception 'unknown shop' using errcode = '22023';
  end if;
  select level into v_level from public.team_shops
   where team_id = v_team and shop_id = p_shop_id for update;
  if not found then
    raise exception 'unknown shop' using errcode = '22023';
  end if;
  if v_level >= 3 then
    raise exception 'shop is at max level' using errcode = 'P0001';
  end if;

  v_cost := v_costs[v_level + 1];
  select money into v_money from public.tycoons where team_id = v_team for update;
  if v_money < v_cost then
    raise exception 'not enough money' using errcode = 'P0001';
  end if;

  update public.tycoons set money = money - v_cost, updated_at = now() where team_id = v_team;
  update public.team_shops set level = v_level + 1 where team_id = v_team and shop_id = p_shop_id;
  insert into public.economy_transactions(team_id, kind, amount, metadata)
  values (v_team, case when v_level = 0 then 'shop_purchase' else 'shop_upgrade' end, -v_cost,
          jsonb_build_object('shop_id', p_shop_id, 'level', v_level + 1));
  return v_level + 1;
end; $$;

revoke all on function public.purchase_or_upgrade_shop(text) from public, anon;
grant execute on function public.purchase_or_upgrade_shop(text) to authenticated;

-- Leaderboard: Total Earned = balance + assets -----------------------------------------
-- asset_value = sum of what was paid to reach each shop's current level.
drop view if exists public.leaderboard;
create view public.leaderboard with (security_invoker = true) as
select t.id as team_id,
       t.event_id,
       t.team_number,
       t.name,
       ty.money,
       ty.customer_count,
       coalesce(a.asset_value, 0)::integer as asset_value,
       (ty.money + coalesce(a.asset_value, 0))::integer as total_earned,
       coalesce(tx.results_count, 0)::integer as results_count
  from public.teams t
  join public.tycoons ty on ty.team_id = t.id
  left join (
    select ts.team_id,
           sum((select coalesce(sum(u), 0) from unnest(sc.upgrade_costs[1:ts.level]) as u)) as asset_value
      from public.team_shops ts join public.shop_catalog sc on sc.id = ts.shop_id
     group by ts.team_id
  ) a on a.team_id = t.id
  left join (
    select team_id, count(*) filter (where kind = 'position_award') as results_count
      from public.economy_transactions group by team_id
  ) tx on tx.team_id = t.id;

revoke all on public.leaderboard from anon;
grant select on public.leaderboard to authenticated;

-- Realtime: team_shops changes move the leaderboard too ---------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.team_shops;
    exception when duplicate_object then null;
    end;
  end if;
end $$;
