insert into public.events(id, name, status) values ('00000000-0000-0000-0000-000000000001', 'Rally Tycoon SMP', 'ready');
insert into public.positions(event_id, position_number, name, kind)
select '00000000-0000-0000-0000-000000000001', n, 'Pos ' || n, case when n <= 9 then 'solo'::public.position_kind else 'duel'::public.position_kind end from generate_series(1,12) n;
insert into public.teams(event_id, team_number, name)
select '00000000-0000-0000-0000-000000000001', n, 'Tim ' || n from generate_series(1,15) n;
insert into public.rounds(event_id, round_number)
select '00000000-0000-0000-0000-000000000001', n from generate_series(1,15) n;
insert into public.tycoons(team_id) select id from public.teams;
insert into public.shop_catalog(id, name, purchase_cost, upgrade_costs, income_by_level) values
('kiosk','Kios',0,array[0,80,140],array[4,6,9]), ('arcade','Arcade',120,array[120,150,210],array[7,10,14]), ('cafe','Kafe',200,array[200,220,300],array[10,15,21]);
insert into public.team_shops(team_id, shop_id, level) select id, 'kiosk', 1 from public.teams;
insert into public.team_shops(team_id, shop_id, level) select id, 'arcade', 0 from public.teams;
insert into public.team_shops(team_id, shop_id, level) select id, 'cafe', 0 from public.teams;

-- Round assignments (formula identical to migrations 004/006 and src/features/rally/schedule.ts).
-- Lives here because it needs the rows above; migration 004 runs before seed.sql on a reset.
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
