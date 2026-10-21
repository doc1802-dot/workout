import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Badge, EmptyState, ErrorNotice, Loading, Metric, Panel } from '../components/ui'
import RouteMap from '../components/RouteMap'
import SportIcon from '../components/SportIcon'
import StreamChart from '../components/analytics/StreamChart'
import LinkedRouteMap from '../components/analytics/LinkedRouteMap'
import SplitTable from '../components/analytics/SplitTable'
import { api } from '../lib/api'
import { clock, dateLabel, number, pace, speed } from '../lib/format'

function Detail({ data }) {
  const [hoveredIndex, setHoveredIndex] = useState(null)
  const [series, setSeries] = useState('heartrate')
  const w = data.workout
  const s = data.strava
  const streams = s?.streams
  const bike = w.sport === '바이크'
  const cadenceUnit = w.cadence_unit || (bike ? 'rpm' : 'spm')
  const velocity =
    s?.average_speed_kmh ??
    (w.distance_km > 0 && w.duration_sec > 0 ? (w.distance_km / w.duration_sec) * 3600 : null)
  const metrics = [
    ['거리', w.distance_km, 'km'],
    ['이동 시간', w.duration_sec == null ? null : clock(w.duration_sec)],
    [
      bike ? '평균 속도' : '평균 페이스',
      velocity == null || (!bike && velocity <= 0)
        ? null
        : bike
          ? speed(velocity)
          : pace(3600 / velocity),
      bike ? 'km/h' : '/km',
    ],
    ['고도 상승', w.elevation_gain_m, 'm'],
    ['칼로리', s?.calories ?? w.calories, 'kcal'],
    ['평균 심박', w.avg_hr, 'bpm'],
    ['최대 심박', w.max_hr, 'bpm'],
    ['평균 케이던스', w.avg_cad, cadenceUnit],
    ['평균 파워', s?.average_watts ?? w.avg_watts, 'W'],
    ['가중 파워', s?.weighted_watts, 'W'],
    ['킬로줄', s?.kilojoules, 'kJ'],
    ['상대 노력', s?.suffer_score],
  ].filter(([, value]) => value != null)
  const sensors = [
    ['평균 심박', w.avg_hr, 'bpm'],
    ['최대 심박', w.max_hr, 'bpm'],
    ['평균 케이던스', w.avg_cad, cadenceUnit],
    ['최대 케이던스', w.max_cad, cadenceUnit],
    ['평균 파워', s?.average_watts ?? w.avg_watts, 'W'],
    ['최대 파워', s?.max_watts, 'W'],
    ['가중 파워', s?.weighted_watts, 'W'],
    ['최대 속도', s?.max_speed_kmh ?? w.max_speed_kmh, 'km/h'],
  ].filter(([, value]) => value != null)
  const choices = [
    ['heartrate', '심박', 'bpm'],
    ['speed_kmh', '속도', 'km/h'],
    ['cadence', '케이던스', cadenceUnit],
    ['watts', '파워', 'W'],
  ].filter(([key]) =>
    streams?.[key]?.some(
      (value, index) => Number.isFinite(value) && Number.isFinite(streams.distance_km?.[index]),
    ),
  )
  const selected = choices.find(([key]) => key === series) || choices[0]
  const elevation = streams?.altitude_m?.some(
    (value, index) => Number.isFinite(value) && Number.isFinite(streams.distance_km?.[index]),
  )
  const polyline = s?.polyline || w.polyline
  const hasRoute = polyline || streams?.latlng?.length
  return (
    <div className="grid min-w-0 gap-6">
      <header>
        <Link to="/" className="mb-5 inline-block rounded text-body-md text-primary">
          ← 피드로 돌아가기
        </Link>
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <SportIcon sport={w.sport} />
          <Badge>{w.sport}</Badge>
          {w.source && (
            <Badge>{w.source === 'manual' ? '수동 기록' : w.source.toUpperCase()}</Badge>
          )}
          <span className="font-label-caps text-label-caps text-on-surface-variant">
            ACTIVITY ANALYSIS
          </span>
        </div>
        <h1 className="break-words">{w.name || `${w.date} ${w.sport}`}</h1>
        <p className="mt-3 text-on-surface-variant">
          {dateLabel(w.started_at || w.date)}
          {w.started_at &&
            ` · ${new Date(w.started_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}`}
        </p>
        {s?.url && (
          <a href={s.url} target="_blank" rel="noreferrer" className="secondary mt-4">
            Strava에서 보기 ↗
          </a>
        )}
        {[...new Set([s?.description, w.memo].filter(Boolean))].map((text) => (
          <p
            key={text}
            className="mt-4 whitespace-pre-wrap break-words text-body-md text-on-surface-variant"
          >
            {text}
          </p>
        ))}
      </header>
      {data.strava_error && (
        <ErrorNotice
          message={`Strava 상세 정보를 불러올 수 없습니다. 저장된 운동 기록을 표시합니다. ${data.strava_error}`}
        />
      )}
      <section
        aria-label="활동 핵심 지표"
        className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border-t-2 border-primary-container bg-surface-container-highest md:grid-cols-3 xl:grid-cols-4"
      >
        {metrics.map(([label, value, unit]) => (
          <Metric
            key={label}
            label={label}
            value={typeof value === 'number' ? number(value) : value}
            unit={unit}
            className="bg-surface-container p-5"
          />
        ))}
      </section>
      {!s && (
        <p className="rounded-xl bg-surface-container p-5 text-on-surface-variant">
          상세 경로·센서·스플릿 분석은 Strava 활동에서 제공됩니다.
        </p>
      )}
      <div className="grid min-w-0 items-start gap-6 xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <div className="grid min-w-0 gap-6">
          {hasRoute && (
            <Panel
              title="GPS 활동 경로"
              subtitle="ROUTE TELEMETRY"
              className="min-w-0 overflow-hidden"
            >
              {elevation && streams?.latlng?.length ? (
                <LinkedRouteMap
                  polyline={polyline}
                  latlng={streams.latlng}
                  hoveredIndex={hoveredIndex}
                />
              ) : (
                <RouteMap
                  polyline={polyline}
                  latlng={polyline ? undefined : streams?.latlng}
                  height={320}
                  interactive
                />
              )}
            </Panel>
          )}
          {elevation && (
            <Panel title="GPS 고도 그래디언트 프로파일" subtitle="ELEVATION / DISTANCE">
              <StreamChart
                distance={streams.distance_km}
                values={streams.altitude_m}
                grade={streams.grade}
                label="고도"
                unit="m"
                onHover={setHoveredIndex}
              />
            </Panel>
          )}
          {selected && (
            <Panel title="구간별 센서 분석" subtitle="PERFORMANCE / DISTANCE">
              <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="센서 차트 선택">
                {choices.map(([key, label]) => (
                  <button
                    key={key}
                    className={selected[0] === key ? 'button' : 'secondary'}
                    aria-pressed={selected[0] === key}
                    onClick={() => setSeries(key)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <StreamChart
                key={selected[0]}
                distance={streams.distance_km}
                values={streams[selected[0]]}
                label={selected[1]}
                unit={selected[2]}
              />
            </Panel>
          )}
          {s && !elevation && !selected && (
            <EmptyState
              title="상세 스트림 데이터가 없습니다"
              description="이 활동에서 제공된 요약 및 구간 기록을 확인하세요."
            />
          )}
        </div>
        <div className="grid min-w-0 gap-6">
          {(sensors.length > 0 || s?.device_name || s?.gear) && (
            <Panel title="퍼포먼스 텔레메트리 (Sensors)" subtitle="RECORDED SENSOR DATA">
              <div className="grid grid-cols-2 gap-4">
                {sensors.map(([label, value, unit]) => (
                  <Metric
                    key={label}
                    label={label}
                    value={number(value)}
                    unit={unit}
                    className="rounded-lg bg-surface-container-low p-3"
                  />
                ))}
              </div>
              {s?.device_name && (
                <p className="mt-5 break-words text-body-md">기록 장치 · {s.device_name}</p>
              )}
              {s?.gear && (
                <p className="mt-3 break-words text-body-md">
                  기어 · {s.gear.name}
                  {s.gear.distance_km != null && ` · 누적 ${number(s.gear.distance_km)} km`}
                </p>
              )}
            </Panel>
          )}
          {s && (
            <Panel title="매칭 세그먼트" subtitle="SEGMENTS">
              {s.segments?.length ? (
                <ul className="grid gap-3">
                  {s.segments.map((segment, index) => (
                    <li
                      key={`${segment.id}-${index}`}
                      className="rounded-lg bg-surface-container-low p-4"
                    >
                      <a
                        className="break-words text-primary hover:underline"
                        href={`https://www.strava.com/segments/${encodeURIComponent(segment.id)}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {segment.name} ↗
                      </a>
                      <div className="my-2 flex flex-wrap gap-2">
                        {[1, 2, 3].includes(segment.pr_rank) && (
                          <Badge>{['PR', '2nd best', '3rd best'][segment.pr_rank - 1]}</Badge>
                        )}
                        {segment.kom_rank != null && <Badge>KOM {segment.kom_rank}위</Badge>}
                      </div>
                      <p className="text-body-sm text-on-surface-variant">
                        {segment.distance_km != null && `${number(segment.distance_km)} km · `}
                        {clock(segment.elapsed_sec ?? segment.moving_sec)}
                        {segment.avg_grade != null && ` · 평균 경사 ${number(segment.avg_grade)}%`}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-on-surface-variant">매칭된 세그먼트가 없습니다.</p>
              )}
            </Panel>
          )}
        </div>
      </div>
      {s && <SplitTable rows={s.splits || []} bike={bike} />}
      {s?.laps?.length > 1 && <SplitTable rows={s.laps} bike={bike} laps />}
    </div>
  )
}

export default function ActivityDetail() {
  const { id } = useParams()
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    api(`/workouts/${encodeURIComponent(id)}/detail`)
      .then((data) => {
        if (active) setResult({ id, data })
      })
      .catch((err) => {
        if (active) setError(err.message)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [id, retry])
  if (loading) return <Loading label="활동 상세 분석을 불러오는 중…" />
  if (error)
    return (
      <div className="grid gap-5">
        <Link to="/" className="text-primary">
          ← 피드로 돌아가기
        </Link>
        {/404|찾을 수 없|not found/i.test(error) ? (
          <EmptyState title="활동을 찾을 수 없습니다" description={error} />
        ) : (
          <ErrorNotice message={error} onRetry={() => setRetry((value) => value + 1)} />
        )}
      </div>
    )
  if (result?.id !== id || !result?.data?.workout)
    return (
      <EmptyState
        title="활동을 찾을 수 없습니다"
        actions={
          <Link to="/" className="secondary mt-4">
            피드로 돌아가기
          </Link>
        }
      />
    )
  return <Detail key={id} data={result.data} />
}
