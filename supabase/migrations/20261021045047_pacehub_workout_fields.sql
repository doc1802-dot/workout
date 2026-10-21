-- PACEHUB 화면용: 피드 지도, 응원 수, 파워, 최고 속도, 장비
alter table public.workouts
  add column if not exists polyline text,
  add column if not exists kudos_count integer check (kudos_count >= 0),
  add column if not exists avg_watts integer check (avg_watts >= 0),
  add column if not exists max_speed_kmh numeric(6,2) check (max_speed_kmh >= 0),
  add column if not exists gear_id text;
