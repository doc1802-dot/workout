-- Strava 웹훅(자동 동기화)용 DB 함수.
-- 웹훅 요청에는 사용자 로그인 토큰이 없어서 RLS로는 쓸 수 없다. 그렇다고 서버에 모든 권한(service role)
-- 키를 두는 대신, 웹훅이 할 일만 하는 함수를 만들고 비밀값(서버 환경변수)을 아는 호출만 받는다.
-- 비밀값 원문은 DB에 두지 않고 SHA-256 해시만 private 스키마에 저장한다 (값은 마이그레이션 밖에서 넣음).

create extension if not exists pgcrypto with schema extensions;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.app_secrets (
  name text primary key,
  sha256 text not null
);
revoke all on private.app_secrets from public, anon, authenticated;

create or replace function private.check_webhook_secret(p_secret text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_secret is null or not exists (
    select 1 from private.app_secrets
    where name = 'strava_webhook'
      and sha256 = encode(extensions.digest(p_secret, 'sha256'), 'hex')
  ) then
    raise exception 'invalid webhook secret' using errcode = '42501';
  end if;
end;
$$;
revoke all on function private.check_webhook_secret(text) from public, anon, authenticated;

-- Strava 선수 id → 연결된 사용자와 토큰
create or replace function public.strava_webhook_connection(p_secret text, p_athlete_id bigint)
returns table (user_id uuid, access_token text, refresh_token text, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.check_webhook_secret(p_secret);
  return query
    select c.user_id, c.access_token, c.refresh_token, c.expires_at
    from public.strava_connections c
    where c.athlete_id = p_athlete_id;
end;
$$;

-- 갱신한 토큰 저장
create or replace function public.strava_webhook_save_tokens(
  p_secret text, p_user_id uuid, p_access_token text, p_refresh_token text, p_expires_at timestamptz)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.check_webhook_secret(p_secret);
  update public.strava_connections
    set access_token = p_access_token, refresh_token = p_refresh_token, expires_at = p_expires_at
    where user_id = p_user_id;
end;
$$;

-- Strava 활동 한 건 저장 (있으면 갱신, 메모는 유지)
create or replace function public.strava_webhook_upsert(p_secret text, p_user_id uuid, p_row jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.workouts;
begin
  perform private.check_webhook_secret(p_secret);
  r := jsonb_populate_record(null::public.workouts, p_row);
  insert into public.workouts (
    user_id, date, started_at, sport, name, distance_km, duration_sec, avg_hr, max_hr, avg_cad,
    max_cad, calories, elevation_gain_m, memo, source, external_id, polyline, kudos_count,
    avg_watts, max_speed_kmh, gear_id)
  values (
    p_user_id, r.date, r.started_at, r.sport, r.name, r.distance_km, r.duration_sec, r.avg_hr,
    r.max_hr, r.avg_cad, r.max_cad, r.calories, r.elevation_gain_m, '', 'strava', r.external_id,
    r.polyline, r.kudos_count, r.avg_watts, r.max_speed_kmh, r.gear_id)
  on conflict (user_id, source, external_id) do update set
    date = excluded.date, started_at = excluded.started_at, sport = excluded.sport,
    name = excluded.name, distance_km = excluded.distance_km, duration_sec = excluded.duration_sec,
    avg_hr = excluded.avg_hr, max_hr = excluded.max_hr, avg_cad = excluded.avg_cad,
    max_cad = excluded.max_cad, calories = excluded.calories,
    elevation_gain_m = excluded.elevation_gain_m, polyline = excluded.polyline,
    kudos_count = excluded.kudos_count, avg_watts = excluded.avg_watts,
    max_speed_kmh = excluded.max_speed_kmh, gear_id = excluded.gear_id;
end;
$$;

-- Strava에서 지운 활동 삭제
create or replace function public.strava_webhook_delete(p_secret text, p_user_id uuid, p_external_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.check_webhook_secret(p_secret);
  delete from public.workouts
    where user_id = p_user_id and source = 'strava' and external_id = p_external_id;
end;
$$;

-- 사용자가 Strava에서 앱 권한을 해제함
create or replace function public.strava_webhook_disconnect(p_secret text, p_athlete_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.check_webhook_secret(p_secret);
  delete from public.strava_connections where athlete_id = p_athlete_id;
end;
$$;

-- 웹훅 함수는 비밀값을 아는 서버만 부르므로 anon에만 실행 권한을 준다
revoke all on function public.strava_webhook_connection(text, bigint) from public, authenticated;
revoke all on function public.strava_webhook_save_tokens(text, uuid, text, text, timestamptz) from public, authenticated;
revoke all on function public.strava_webhook_upsert(text, uuid, jsonb) from public, authenticated;
revoke all on function public.strava_webhook_delete(text, uuid, text) from public, authenticated;
revoke all on function public.strava_webhook_disconnect(text, bigint) from public, authenticated;
grant execute on function public.strava_webhook_connection(text, bigint) to anon;
grant execute on function public.strava_webhook_save_tokens(text, uuid, text, text, timestamptz) to anon;
grant execute on function public.strava_webhook_upsert(text, uuid, jsonb) to anon;
grant execute on function public.strava_webhook_delete(text, uuid, text) to anon;
grant execute on function public.strava_webhook_disconnect(text, bigint) to anon;
