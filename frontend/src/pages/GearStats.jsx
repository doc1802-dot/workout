import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { supabase } from '../lib/supabase'
import { number, duration, today } from '../lib/format'
import { Panel, Metric, Badge, EmptyState, ErrorNotice, Loading, Icon } from '../components/ui'
import SportIcon from '../components/SportIcon'
import GearCalendar from '../components/gear/GearCalendar'
import GearGoal from '../components/gear/GearGoal'
import { achievements } from '../components/gear/achievements'

export default function GearStats() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [profileError, setProfileError] = useState('')
  const [version, setVersion] = useState(0)
  const [period, setPeriod] = useState('all')
  const month = today().slice(0, 7)
  const year = Number(month.slice(0, 4))
  useEffect(() => {
    let active = true
    setData(null)
    setError('')
    setProfileError('')
    async function load() {
      try {
        const results = await Promise.allSettled([
          api('/strava/status'),
          api('/stats/summary'),
          api(`/stats/summary?year=${year}`),
          api(`/stats/summary?year=${year}&month=${Number(month.slice(5))}`),
          api('/workouts'),
          supabase.auth.getSession(),
        ])
        const failure = results.find((result) => result.status === 'rejected')
        if (failure) throw failure.reason
        const [status, all, ytd, monthly, workouts, session] = results.map((result) => result.value)
        if (session.error) throw session.error
        let profile = null
        if (status.connected) {
          try {
            profile = await api('/strava/profile')
          } catch (error) {
            if (active) setProfileError(error.message)
          }
        }
        if (active)
          setData({
            status,
            all,
            ytd,
            monthly,
            workouts,
            user: session.data.session?.user,
            profile,
          })
      } catch (error) {
        if (active) setError(error.message)
      }
    }
    load()
    return () => {
      active = false
    }
  }, [year, month, version])
  const retry = () => setVersion((v) => v + 1)
  if (error) return <ErrorNotice message={error} onRetry={retry} />
  if (!data) return <Loading />
  const { status, profile, user, workouts, monthly } = data
  const athlete = profile?.athlete
  const effectivePeriod = !profile && period === 'recent' ? 'all' : period
  const summary = effectivePeriod === 'ytd' ? data.ytd : data.all
  const gear = [
    ...(profile?.gear.bikes || []).map((item) => ({ ...item, sport: '바이크', guideline: 3000 })),
    ...(profile?.gear.shoes || []).map((item) => ({ ...item, sport: '러닝', guideline: 800 })),
  ]
  const badges = achievements(workouts, month)
  return (
    <div className="min-w-0 space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="mb-2 font-label-caps text-label-caps text-primary-container">
            MY STATS & GEAR
          </p>
          <h1>마이 통계 & 기어 관리</h1>
        </div>
        <Link className="secondary" to="/settings">
          <Icon name="settings" />
          연동 설정
        </Link>
      </header>
      <section className="flex flex-wrap items-center gap-5 rounded-xl border-l-4 border-primary-container bg-surface-container p-6">
        {athlete?.profile_url ? (
          <img
            src={athlete.profile_url}
            alt={`${athlete.name} 프로필`}
            className="h-20 w-20 rounded-xl object-cover"
          />
        ) : (
          <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-surface-container-high text-primary-container">
            <Icon name="person" className="!h-12 !w-12 !text-5xl" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="break-all">{athlete?.name || user?.email || '내 프로필'}</h2>
            {athlete?.premium && <Badge>STRAVA PREMIUM</Badge>}
          </div>
          {athlete && (
            <>
              <p className="mt-2 text-on-surface-variant">
                {[athlete.city, athlete.country].filter(Boolean).join(' · ')}
              </p>
              <p className="mt-2 text-body-md">
                {athlete.follower_count != null && `팔로워 ${number(athlete.follower_count)}`}
                {athlete.friend_count != null && ` · 팔로잉 ${number(athlete.friend_count)}`}
              </p>
            </>
          )}
          {!status.connected && (
            <Link className="mt-3 inline-block text-primary underline" to="/settings">
              Strava를 연결하고 프로필과 기어 가져오기
            </Link>
          )}
        </div>
        <Badge>{status.connected ? 'STRAVA 연결됨' : '로컬 운동 기록'}</Badge>
      </section>
      {profileError && <ErrorNotice message={profileError} onRetry={retry} />}
      <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
        <Panel
          title="누적 마일리지 분석"
          subtitle={profile ? 'STRAVA ATHLETE TOTALS' : 'PACEHUB에 저장된 운동 기록'}
          actions={
            <div className="flex flex-wrap gap-1" role="group" aria-label="통계 기간">
              {(profile
                ? [
                    ['recent', '최근 4주'],
                    ['ytd', '올해'],
                    ['all', '전체'],
                  ]
                : [
                    ['ytd', '올해'],
                    ['all', '전체'],
                  ]
              ).map(([key, label]) => (
                <button
                  key={key}
                  aria-pressed={effectivePeriod === key}
                  className={effectivePeriod === key ? 'button' : 'secondary'}
                  onClick={() => setPeriod(key)}
                >
                  {label}
                </button>
              ))}
            </div>
          }
        >
          <div className="grid gap-5 md:grid-cols-2">
            {[
              ['러닝', 'run'],
              ['바이크', 'ride'],
            ].map(([sport, key]) => {
              const total = profile?.totals[`${effectivePeriod}_${key}`] ||
                summary.by_sport.find((row) => row.sport === sport) || {
                  count: 0,
                  distance_km: 0,
                  duration_sec: 0,
                }
              const elevationRows = workouts.filter(
                (row) =>
                  row.sport === sport &&
                  (effectivePeriod !== 'ytd' || row.date.startsWith(String(year))),
              )
              const elevation = profile
                ? total.elevation_m
                : elevationRows.some((row) => row.elevation_gain_m != null)
                  ? elevationRows.reduce((sum, row) => sum + Number(row.elevation_gain_m || 0), 0)
                  : null
              return (
                <div key={sport} className="rounded-xl bg-surface-container-lowest p-5">
                  <h3 className="mb-5 flex items-center gap-2">
                    <SportIcon sport={sport} />
                    {sport}
                  </h3>
                  <Metric label="누적 거리" value={number(total.distance_km)} unit="km" />
                  <div className="mt-6 grid gap-4">
                    <p className="flex justify-between">
                      <span className="text-on-surface-variant">활동</span>
                      <span className="font-metric-md">{number(total.count)} 회</span>
                    </p>
                    <p className="flex flex-wrap justify-between gap-2">
                      <span className="text-on-surface-variant">이동 시간</span>
                      <span className="font-metric-md">
                        {duration(total.moving_sec ?? total.duration_sec ?? 0)}
                      </span>
                    </p>
                    <p className="flex justify-between">
                      <span className="text-on-surface-variant">획득 고도</span>
                      <span className="font-metric-md">
                        {elevation == null ? '데이터 없음' : `${number(elevation)} m`}
                      </span>
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </Panel>
        <GearGoal summary={monthly} userId={user?.id} />
      </div>
      <GearCalendar />
      <Panel title="기어 마일리지 및 부품 정비 알림" subtitle="STRAVA GEAR · TOTAL DISTANCE">
        <p className="mb-5 text-body-md text-on-surface-variant">
          일반 권장 교체 기준: 러닝화 800 km · 자전거 체인 3,000 km. Strava 기어 누적 거리와 비교한
          참고 기준이며, 실제 마모도나 부품 교체 후 주행 거리가 아닙니다.
        </p>
        {!gear.length ? (
          <EmptyState
            title={
              status.connected
                ? '등록된 기어가 없습니다'
                : 'Strava를 연결하면 기어를 확인할 수 있습니다'
            }
            actions={
              !status.connected && (
                <Link className="button mt-4" to="/settings">
                  Strava 연결하기
                </Link>
              )
            }
          />
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {gear.map((item) => (
              <article key={item.id} className="min-w-0 rounded-xl bg-surface-container-lowest p-5">
                <div className="flex flex-wrap items-center gap-3">
                  <SportIcon sport={item.sport} />
                  <h3 className="break-words font-headline-sm text-headline-sm">{item.name}</h3>
                  {item.primary && <Badge>기본 기어</Badge>}
                </div>
                <p className="my-5 font-metric-lg text-metric-lg">
                  {number(item.distance_km)} <span className="text-body-md">km</span>
                </p>
                <div
                  role="progressbar"
                  aria-label={`${item.name} 일반 권장 교체 기준 대비 거리`}
                  aria-valuenow={Math.min(100, (item.distance_km / item.guideline) * 100)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  className="h-2 overflow-hidden rounded-full bg-surface-container-high"
                >
                  <div
                    className={`h-full ${item.sport === '러닝' ? 'bg-primary-container' : 'bg-secondary-container'}`}
                    style={{
                      width: `${Math.min(100, (item.distance_km / item.guideline) * 100)}%`,
                    }}
                  />
                </div>
                <p className="mt-3 text-body-sm text-on-surface-variant">
                  {item.sport === '러닝' ? '러닝화' : '체인'} 일반 권장 교체 기준{' '}
                  {number(item.guideline)} km · {number((item.distance_km / item.guideline) * 100)}%
                </p>
                {item.distance_km >= item.guideline && (
                  <p className="mt-3 text-primary">
                    누적 거리가 참고 기준에 도달했습니다. 실제 상태와 정비 이력을 확인하세요.
                  </p>
                )}
              </article>
            ))}
          </div>
        )}
      </Panel>
      <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
        <Panel
          title="배지 & 챌린지 달성 현황"
          subtitle="저장된 운동 기록으로 계산 · STRAVA 공식 배지 아님"
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {badges.map((badge) => (
              <article key={badge.title} className="rounded-xl bg-surface-container-lowest p-4">
                <Icon
                  name={badge.date ? 'military_tech' : 'flag'}
                  className={badge.date ? 'text-secondary-container' : 'text-on-surface-variant'}
                />
                <h3 className="mt-3 font-semibold">{badge.title}</h3>
                <p className="my-3 font-metric-md text-primary">
                  {number(badge.value)} / {number(badge.target)} {badge.unit}
                </p>
                <p className="text-body-sm text-on-surface-variant">
                  {badge.date
                    ? `달성 · ${badge.date}`
                    : `진행 중 · ${number(Math.min(100, (badge.value / badge.target) * 100))}%`}
                </p>
              </article>
            ))}
          </div>
        </Panel>
        <Panel title="시스템 & 연동" subtitle="ACCOUNT CONNECTION">
          <div className="mb-5 flex items-center gap-3 rounded-lg bg-surface-container-lowest p-4">
            <Icon name="hub" className="text-secondary-container" />
            <div>
              <p>Strava</p>
              <p className="mt-1 text-body-sm text-on-surface-variant">
                {status.connected ? '연결됨' : '연결 안 됨'}
              </p>
            </div>
          </div>
          <p className="mb-5 text-body-md text-on-surface-variant">
            연동 계정, 운동 기록 동기화와 CSV 가져오기를 관리하세요.
          </p>
          <Link className="secondary w-full" to="/settings">
            설정으로 이동
            <Icon name="arrow_forward" />
          </Link>
        </Panel>
      </div>
    </div>
  )
}
