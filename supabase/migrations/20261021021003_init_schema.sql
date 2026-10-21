-- 운동기록 테이블 (예전 records.csv 한 줄 = workouts 한 행)
create table public.workouts (
    id               uuid primary key default gen_random_uuid(),
    user_id          uuid not null default auth.uid() references auth.users (id) on delete cascade,
    date             date not null,
    started_at       timestamptz,
    sport            text not null check (sport in ('러닝', '바이크', '하이킹', '걷기', '수영', '기타')),
    name             text,
    distance_km      numeric(8, 2) not null check (distance_km >= 0),
    duration_sec     integer not null check (duration_sec > 0),
    avg_hr           integer check (avg_hr >= 0),
    max_hr           integer check (max_hr >= 0),
    avg_cad          integer check (avg_cad >= 0),
    max_cad          integer check (max_cad >= 0),
    calories         integer check (calories >= 0),
    elevation_gain_m numeric(8, 1),
    memo             text not null default '',
    source           text not null default 'manual' check (source in ('manual', 'strava', 'csv')),
    external_id      text,
    created_at       timestamptz not null default now(),
    updated_at       timestamptz not null default now(),
    -- 같은 Strava 활동을 두 번 가져와도 한 번만 저장
    unique (user_id, source, external_id)
);

create index workouts_user_date_idx on public.workouts (user_id, date desc);

-- Strava 연결 정보 (사용자당 1개)
create table public.strava_connections (
    user_id        uuid primary key default auth.uid() references auth.users (id) on delete cascade,
    athlete_id     bigint not null,
    athlete_name   text not null default '',
    access_token   text not null,
    refresh_token  text not null,
    expires_at     timestamptz not null,
    scope          text not null default '',
    last_synced_at timestamptz,
    created_at     timestamptz not null default now(),
    updated_at     timestamptz not null default now()
);

-- updated_at 자동 갱신
create function public.set_updated_at() returns trigger
language plpgsql
set search_path = ''
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

create trigger workouts_set_updated_at
    before update on public.workouts
    for each row execute function public.set_updated_at();

create trigger strava_connections_set_updated_at
    before update on public.strava_connections
    for each row execute function public.set_updated_at();

-- RLS: 본인 데이터만 보고 쓸 수 있다
alter table public.workouts enable row level security;
alter table public.strava_connections enable row level security;

create policy "본인 기록 조회" on public.workouts
    for select to authenticated using ((select auth.uid()) = user_id);
create policy "본인 기록 추가" on public.workouts
    for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "본인 기록 수정" on public.workouts
    for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "본인 기록 삭제" on public.workouts
    for delete to authenticated using ((select auth.uid()) = user_id);

create policy "본인 Strava 연결 조회" on public.strava_connections
    for select to authenticated using ((select auth.uid()) = user_id);
create policy "본인 Strava 연결 추가" on public.strava_connections
    for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "본인 Strava 연결 수정" on public.strava_connections
    for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "본인 Strava 연결 삭제" on public.strava_connections
    for delete to authenticated using ((select auth.uid()) = user_id);

-- 익명 사용자는 아예 접근 불가
revoke all on public.workouts, public.strava_connections from anon;
