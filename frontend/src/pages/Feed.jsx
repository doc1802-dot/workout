import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge, EmptyState, ErrorNotice, Icon, Loading, Metric, Panel } from '../components/ui'
import SportIcon from '../components/SportIcon'
import RouteMap from '../components/RouteMap'
import WorkoutForm from '../components/WorkoutForm'
import { api } from '../lib/api'
import { clock, dateLabel, number, pace, speed } from '../lib/format'

function ActivityCard({ workout: w }) {
  const metrics = [
    ['거리', w.distance_km == null ? null : number(w.distance_km), 'km'],
    ['시간', w.duration_sec == null ? null : clock(w.duration_sec)],
    [
      w.sport === '바이크' ? '속도' : '페이스',
      w.distance_km > 0 && w.duration_sec > 0
        ? w.sport === '바이크'
          ? speed((w.distance_km / w.duration_sec) * 3600)
          : pace(w.duration_sec / w.distance_km)
        : null,
      w.sport === '바이크' ? 'km/h' : '/km',
    ],
    ['고도', w.elevation_gain_m, 'm'],
    ['평균 심박', w.avg_hr, 'bpm'],
    ['칼로리', w.calories, 'kcal'],
    ['케이던스', w.avg_cad, w.cadence_unit || ''],
    ['파워', w.avg_watts, 'W'],
  ]
  return (
    <article className="min-w-0 overflow-hidden rounded-xl border border-surface-container-high bg-surface-container">
      <div className="p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-container-lowest">
              <SportIcon sport={w.sport} />
            </span>
            <div>
              <p className="font-label-caps text-label-caps text-primary">{w.sport}</p>
              <time className="text-body-sm text-on-surface-variant" dateTime={w.date}>
                {dateLabel(w.date)}
              </time>
            </div>
          </div>
          {w.source &&
            (w.source.toLowerCase() === 'strava' && w.external_id ? (
              <a
                href={`https://www.strava.com/activities/${encodeURIComponent(w.external_id)}`}
                target="_blank"
                rel="noreferrer"
                className="rounded"
              >
                <Badge>STRAVA ↗</Badge>
              </a>
            ) : (
              <Badge>{w.source === 'manual' ? '수동 기록' : w.source}</Badge>
            ))}
        </div>
        <h2 className="break-words font-headline-md text-headline-md text-white">
          <Link to={`/activities/${w.id}`} className="rounded hover:text-primary">
            {w.name || `${w.date} ${w.sport}`}
          </Link>
        </h2>
        {w.memo && (
          <p className="mt-3 whitespace-pre-wrap break-words text-body-md text-on-surface-variant">
            {w.memo}
          </p>
        )}
      </div>
      {w.polyline && <RouteMap polyline={w.polyline} />}
      <div className="grid grid-cols-2 gap-x-4 gap-y-6 border-t border-surface-container-highest bg-surface-container-lowest/40 p-5 sm:grid-cols-3 xl:grid-cols-4">
        {metrics
          .filter(([, value]) => value != null)
          .map(([label, value, unit]) => (
            <Metric key={label} label={label} value={value} unit={unit} />
          ))}
      </div>
      {w.kudos_count != null && (
        <div className="flex items-center gap-2 bg-surface-container-low px-5 py-3 text-body-sm">
          <Icon name="local_fire_department" className="text-primary-container" />
          <span>
            Kudos <span className="font-metric-md text-primary">{number(w.kudos_count)}</span>
          </span>
        </div>
      )}
    </article>
  )
}

function ComposerDialog({ onClose, onSaved }) {
  const dialog = useRef(null)
  useEffect(() => {
    const node = dialog.current
    node.showModal()
    return () => node.close()
  }, [])
  return (
    <dialog
      ref={dialog}
      aria-label="새로운 운동 기록"
      onCancel={(event) => {
        event.preventDefault()
        // Keep an in-flight save mounted, matching WorkoutForm's disabled fieldset.
        if (!dialog.current.querySelector('fieldset:disabled')) onClose()
      }}
    >
      <WorkoutForm onSaved={onSaved} onCancel={onClose} />
    </dialog>
  )
}

function Summaries({ workouts, records, prError, status, onRetry }) {
  const totals = useMemo(() => {
    const now = new Date()
    const week = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    week.setDate(week.getDate() - ((week.getDay() + 6) % 7))
    const previous = new Date(week)
    previous.setDate(previous.getDate() - 7)
    const month = new Date(now.getFullYear(), now.getMonth(), 1)
    const current = { count: 0, distance: 0, seconds: 0 }
    const last = { count: 0, distance: 0, seconds: 0 }
    const bySport = {}
    workouts.forEach((w) => {
      const date = new Date(`${w.date}T00:00:00`)
      if (date > now) return
      const bucket = date >= week ? current : date >= previous ? last : null
      if (bucket) {
        bucket.count += 1
        bucket.distance += Number(w.distance_km) || 0
        bucket.seconds += Number(w.duration_sec) || 0
      }
      if (date >= month) bySport[w.sport] = (bySport[w.sport] || 0) + (Number(w.distance_km) || 0)
    })
    return { current, last, bySport }
  }, [workouts])
  const { current, last, bySport } = totals
  const distances = Object.entries(bySport).sort((a, b) => b[1] - a[1])
  const maxDistance = Math.max(1, ...distances.map(([, distance]) => distance))
  const signed = (value) => `${value > 0 ? '+' : ''}${number(value)}`
  const prs = [
    ['best_run', '러닝 최고 페이스'],
    ['best_bike', '바이크 최고 속도'],
    ['longest', '최장 거리'],
  ]
  return (
    <aside className="grid min-w-0 content-start gap-5" aria-label="운동 요약">
      <Panel title="이번 주 요약" subtitle="WEEKLY TELEMETRY · 월요일 시작">
        <div className="grid gap-5">
          <Metric
            label="활동"
            value={current.count}
            unit="회"
            sub={`지난주 대비 ${signed(current.count - last.count)}회`}
          />
          <Metric
            label="총 거리"
            value={number(current.distance)}
            unit="km"
            sub={`지난주 대비 ${signed(current.distance - last.distance)} km`}
          />
          <Metric
            label="운동 시간"
            value={clock(current.seconds)}
            sub={`지난주 ${clock(last.seconds)}`}
          />
        </div>
        <p className="mt-4 text-body-sm text-on-surface-variant">
          이번 주 현재까지 · 지난주 전체와 비교
        </p>
      </Panel>
      <Panel title="이번 달 종목별 거리" subtitle="MONTHLY DISTANCE">
        {distances.length ? (
          <div className="grid gap-5">
            {distances.map(([sport, distance]) => (
              <div key={sport}>
                <div className="mb-2 flex items-center justify-between gap-2 text-body-sm">
                  <span className="flex items-center gap-2">
                    <SportIcon sport={sport} />
                    {sport}
                  </span>
                  <span className="font-metric-md">{number(distance)} km</span>
                </div>
                <div className="h-1.5 rounded-full bg-surface-container-highest" aria-hidden="true">
                  <div
                    className="h-full rounded-full bg-secondary-container"
                    style={{ width: `${(distance / maxDistance) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-body-md text-on-surface-variant">이번 달 기록이 없습니다.</p>
        )}
      </Panel>
      <Panel title="최근 개인 기록" subtitle="PERSONAL RECORDS">
        {prError ? (
          <ErrorNotice message={prError} onRetry={onRetry} />
        ) : !records ? (
          <Loading />
        ) : prs.some(([key]) => records[key]) ? (
          <div className="grid gap-3">
            {prs.map(([key, label]) => {
              const record = records[key]
              if (!record) return null
              return (
                <Link
                  key={key}
                  to={`/activities/${record.id}`}
                  className="block rounded-lg bg-surface-container-lowest p-3 hover:bg-surface-container-high"
                >
                  <p className="text-body-sm text-on-surface-variant">{label}</p>
                  <p className="my-2 break-words font-metric-md text-metric-md text-secondary-container">
                    {key === 'longest'
                      ? `${number(record.distance_km)} km`
                      : record.summary ||
                        (key === 'best_run'
                          ? `${pace(record.duration_sec / record.distance_km)} /km`
                          : `${speed((record.distance_km / record.duration_sec) * 3600)} km/h`)}
                  </p>
                  <p className="text-body-sm text-on-surface-variant">{dateLabel(record.date)}</p>
                </Link>
              )
            })}
          </div>
        ) : (
          <p className="text-body-md text-on-surface-variant">개인 기록이 아직 없습니다.</p>
        )}
      </Panel>
      {status?.connected === false && (
        <Panel title="Strava 연결" subtitle="CONNECT YOUR ACTIVITIES">
          <p className="mb-4 text-body-md text-on-surface-variant">
            Strava 활동을 연결해 나의 운동 기록을 모아보세요.
          </p>
          <Link to="/settings" className="button w-full">
            연동 설정 열기 <Icon name="arrow_forward" />
          </Link>
        </Panel>
      )}
    </aside>
  )
}

export default function Feed() {
  const [workouts, setWorkouts] = useState([])
  const [records, setRecords] = useState(null)
  const [status, setStatus] = useState(null)
  const [error, setError] = useState('')
  const [prError, setPrError] = useState('')
  const [loading, setLoading] = useState(true)
  const [version, setVersion] = useState(0)
  const [sport, setSport] = useState('')
  const [limit, setLimit] = useState(10)
  const [composing, setComposing] = useState(false)
  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    setPrError('')
    api('/workouts')
      .then((data) => {
        if (active) setWorkouts(data)
      })
      .catch((error) => {
        if (active) setError(error.message)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    api('/stats/pr')
      .then((data) => {
        if (active) setRecords(data)
      })
      .catch((error) => {
        if (active) setPrError(error.message)
      })
    api('/strava/status')
      .then((data) => {
        if (active) setStatus(data)
      })
      .catch(() => {
        if (active) setStatus(null)
      })
    return () => {
      active = false
    }
  }, [version])
  const filtered = sport ? workouts.filter((w) => w.sport === sport) : workouts
  const sports = [...new Set(workouts.map((w) => w.sport).filter(Boolean))]
  const retry = () => setVersion((value) => value + 1)
  return (
    <>
      <div className="mb-6">
        <p className="mb-2 font-label-caps text-label-caps text-primary-container">
          YOUR ACTIVITY STREAM
        </p>
        <h1>소셜 액티비티 피드</h1>
        <p className="mt-2 text-body-md text-on-surface-variant">나의 움직임, 하나의 타임라인.</p>
      </div>
      <div className="grid min-w-0 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="grid min-w-0 gap-5">
          <Panel
            className="border-l-2 border-primary-container"
            title="오늘의 운동을 기록하세요"
            subtitle="EVERY EFFORT COUNTS"
          >
            <div className="flex flex-wrap gap-3">
              <button className="button" onClick={() => setComposing(true)}>
                <Icon name="add" />
                운동 기록 추가
              </button>
              <Link className="secondary" to="/live">
                <Icon name="sensors" className="text-secondary-container" />
                라이브 기록 시작
              </Link>
            </div>
          </Panel>
          <div className="flex flex-wrap gap-2" role="group" aria-label="종목 필터">
            {['', ...sports].map((value) => (
              <button
                key={value}
                aria-pressed={sport === value}
                onClick={() => {
                  setSport(value)
                  setLimit(10)
                }}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-body-sm ${sport === value ? 'bg-primary-container text-white' : 'bg-surface-container text-on-surface hover:bg-surface-container-high'}`}
              >
                {value && <SportIcon sport={value} />}
                {value || '전체'}
              </button>
            ))}
          </div>
          {loading ? (
            <Loading />
          ) : error ? (
            <ErrorNotice message={error} onRetry={retry} />
          ) : (
            <>
              {!filtered.length && (
                <EmptyState
                  title="아직 활동이 없습니다"
                  description="첫 운동을 기록하고 나만의 피드를 시작하세요."
                />
              )}
              {filtered.slice(0, limit).map((workout) => (
                <ActivityCard key={workout.id} workout={workout} />
              ))}
              {filtered.length > limit && (
                <button
                  className="secondary w-full py-3"
                  onClick={() => setLimit((value) => value + 10)}
                >
                  더 보기 ({Math.min(limit, filtered.length)} / {filtered.length})
                  <Icon name="expand_more" />
                </button>
              )}
            </>
          )}
        </div>
        {!loading && !error && (
          <Summaries
            workouts={workouts}
            records={records}
            prError={prError}
            status={status}
            onRetry={retry}
          />
        )}
      </div>
      {composing && (
        <ComposerDialog
          onClose={() => setComposing(false)}
          onSaved={() => {
            setComposing(false)
            retry()
          }}
        />
      )}
    </>
  )
}
