-- 마지막으로 가져온 Strava 활동의 시작 시각. 다음 동기화는 이 시각 이후 활동만 가져온다.
alter table public.strava_connections add column sync_cursor timestamptz;
