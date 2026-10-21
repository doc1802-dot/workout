import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Metric } from '../components/ui'
import PeriodTree from '../components/PeriodTree'
import { api } from '../lib/api'
import { number, sports } from '../lib/format'

const sportColors = {
  러닝: 'var(--sport-run)',
  바이크: 'var(--sport-bike)',
  하이킹: 'var(--sport-hike)',
  걷기: 'var(--sport-walk)',
  수영: 'var(--sport-swim)',
  기타: 'var(--sport-other)',
}
const sportColor = (sport) => sportColors[sport] || sportColors.기타
const time = (seconds) => `${Math.floor(seconds / 3600)}시간 ${Math.floor((seconds % 3600) / 60)}분`

export default function Dashboard() {
  const [selection, setSelection] = useState({ scope: 'all', year: null, month: null, sport: '' })
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [retry, setRetry] = useState(0)
  const { scope, year, month, sport } = selection

  useEffect(() => {
    let active = true
    const params = new URLSearchParams()
    if (selection.scope !== 'all') params.set('year', selection.year)
    if (selection.scope === 'month') params.set('month', selection.month)
    if (selection.sport) params.set('sport', selection.sport)
    setLoading(true)
    setError('')
    api(`/stats/summary${params.size ? `?${params}` : ''}`)
      .then((data) => {
        if (active) setResult({ data, selection })
      })
      .catch((error) => {
        if (active) setError(error.message)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [selection, retry])

  const data = result?.data
  const years = [...(data?.years || [])].sort((a, b) => a - b)
  const periodSports = (data?.by_sport || []).filter((item) => item.count > 0)
  const visibleSports = [...new Set([...periodSports.map((item) => item.sport), sport])]
    .filter(Boolean)
    .sort((a, b) => {
      const order = (name) => (sports.includes(name) ? sports.indexOf(name) : sports.length)
      return order(a) - order(b)
    })
  const change = (values) => setSelection((previous) => ({ ...previous, ...values }))
  const selectScope = (nextScope) => {
    if (nextScope === scope) return
    const now = new Date()
    const latestYear = years.at(-1) || now.getFullYear()
    const defaultYear = years.includes(now.getFullYear()) ? now.getFullYear() : latestYear
    change({
      scope: nextScope,
      year: nextScope === 'month' ? defaultYear : latestYear,
      month: defaultYear === now.getFullYear() ? now.getMonth() + 1 : 12,
    })
  }
  const movePeriod = (offset) => {
    if (scope === 'year') change({ year: year + offset })
    else {
      const next = new Date(year, month - 1 + offset, 1)
      change({ year: next.getFullYear(), month: next.getMonth() + 1 })
    }
  }
  const stale = Boolean(result && result.selection !== selection)
  const busy = loading || (stale && !error)
  const shown = result?.selection
  const summarySports = (data?.by_sport || []).filter(
    (item) => item.count > 0 && (!shown.sport || item.sport === shown.sport),
  )

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="font-label-caps text-label-caps text-primary">나의 운동 한눈에</p>
          <h1>작은 기록, 꾸준한 변화</h1>
          <p className="muted">지금까지 달리고 움직인 시간을 만나보세요.</p>
        </div>
        <Link className="button" to="/workouts">
          기록 보러 가기 ↗
        </Link>
      </div>
      <section className="panel grid gap-4" aria-label="운동 통계 필터">
        <div className="toggle !my-0 w-fit" role="group" aria-label="기간 범위">
          {[
            ['all', '전체'],
            ['year', '연간'],
            ['month', '월간'],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={scope === value ? 'selected' : ''}
              aria-pressed={scope === value}
              disabled={!data}
              onClick={() => selectScope(value)}
            >
              {label}
            </button>
          ))}
        </div>
        {scope !== 'all' && (
          <div className="flex flex-wrap items-center gap-2 [&_select]:w-auto">
            <button
              type="button"
              className="secondary"
              aria-label={scope === 'year' ? '이전 연도' : '이전 달'}
              disabled={year <= years[0] && (scope === 'year' || month === 1)}
              onClick={() => movePeriod(-1)}
            >
              ◀
            </button>
            <select
              aria-label="연도"
              value={year}
              onChange={(e) => change({ year: +e.target.value })}
            >
              {[...new Set([...years, year])]
                .sort((a, b) => a - b)
                .map((value) => (
                  <option key={value} value={value}>
                    {value}년
                  </option>
                ))}
            </select>
            {scope === 'month' && (
              <select
                aria-label="월"
                value={month}
                onChange={(e) => change({ month: +e.target.value })}
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((value) => (
                  <option key={value} value={value}>
                    {value}월
                  </option>
                ))}
              </select>
            )}
            <button
              type="button"
              className="secondary"
              aria-label={scope === 'year' ? '다음 연도' : '다음 달'}
              disabled={year >= years.at(-1) && (scope === 'year' || month === 12)}
              onClick={() => movePeriod(1)}
            >
              ▶
            </button>
          </div>
        )}
        <div className="flex flex-wrap gap-2" role="group" aria-label="종목 필터">
          {['', ...visibleSports].map((value) => (
            <button
              key={value}
              type="button"
              className={sport === value ? 'button' : 'secondary'}
              aria-pressed={sport === value}
              onClick={() => change({ sport: value })}
            >
              {value || '전체'}
            </button>
          ))}
        </div>
      </section>
      {error && (
        <div className="notice error" role="alert">
          <p>{error}</p>
          <button
            type="button"
            className="secondary"
            onClick={() => setRetry((value) => value + 1)}
          >
            다시 불러오기
          </button>
        </div>
      )}
      {busy && (
        <p className="dashboard-status" role="status">
          운동 기록을 불러오고 있습니다…
        </p>
      )}
      {stale && error && <p className="muted">이전 조회 결과를 표시하고 있습니다.</p>}
      {data && (
        <div className={`grid min-w-0 gap-5 ${busy || stale ? 'opacity-60' : ''}`} aria-busy={busy}>
          {!data.total.count && <p className="empty">선택한 조건에 해당하는 기록이 없습니다.</p>}
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            {[
              ['기록 수', `${number(data.total.count)}회`],
              ['총 거리', `${number(data.total.distance_km)} km`],
              ['총 시간', time(data.total.duration_sec)],
              ['총 칼로리', `${number(data.total.calories)} kcal`],
            ].map(([label, value]) => (
              <section
                className="min-w-0 rounded-xl border-t-2 border-primary-container bg-surface-container p-5"
                key={label}
              >
                <Metric label={label} value={value} />
              </section>
            ))}
          </div>
          <section className="panel">
            <h2>종목별 요약</h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {summarySports.map((item) => (
                <button
                  type="button"
                  className="grid gap-3 rounded-lg bg-surface-container-low p-4 text-left hover:bg-surface-container-high"
                  key={item.sport}
                  disabled={busy || stale}
                  aria-pressed={shown.sport === item.sport}
                  onClick={() => change({ sport: item.sport })}
                >
                  <span>
                    <i
                      className="mr-2 inline-block h-2 w-2 rounded-full"
                      style={{ background: sportColor(item.sport) }}
                    />
                    {item.sport}
                  </span>
                  <strong className="font-metric-lg text-metric-lg text-secondary-container">
                    {number(item.distance_km)} km
                  </strong>
                  <span className="muted">
                    {number(item.count)}회 · {time(item.duration_sec)}
                  </span>
                </button>
              ))}
              {!summarySports.length && <p className="muted">저장된 기록이 없습니다.</p>}
            </div>
          </section>
          <PeriodTree sport={sport} sportColor={sportColor} change={change} />
          <h2 className="section-heading">나의 최고 기록</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {[
              ['best_run', '러닝 최고 페이스'],
              ['best_bike', '바이크 최고 속도'],
              ['longest', '최장 거리'],
            ].map(([key, label]) => (
              <section className="min-w-0 rounded-xl bg-surface-container p-5" key={key}>
                <span className="font-label-caps text-label-caps text-primary">{label}</span>
                {data.pr[key] ? (
                  <>
                    <h3 className="my-3 break-words font-metric-md text-metric-md text-white">
                      <Link className="hover:text-primary" to={`/activities/${data.pr[key].id}`}>
                        {key === 'longest'
                          ? `${number(data.pr[key].distance_km)} km`
                          : data.pr[key].summary}
                      </Link>
                    </h3>
                    {key === 'longest' && <p>{data.pr[key].summary}</p>}
                    <p className="muted">
                      {data.pr[key].date} · {data.pr[key].sport}
                    </p>
                  </>
                ) : (
                  <p className="muted">아직 기록이 없습니다.</p>
                )}
              </section>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
