import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import codec from '@mapbox/polyline'
import { api } from '../lib/api'
import { clock, number, pace, syncAll } from '../lib/format'
import {
  addLap,
  buildGpx,
  createSession,
  defaultName,
  simplifyPoints,
  smoothSpeed,
  SESSION_KEY,
} from '../lib/live/recorder'
import useRecorder from '../lib/live/useRecorder'
import RouteMap from '../components/RouteMap'
import SportIcon from '../components/SportIcon'
import ElevationChart from '../components/live/ElevationChart'
import { Badge, ErrorNotice, Icon, Metric, Panel } from '../components/ui'

const LIVE_SPORTS = ['바이크', '러닝', '하이킹', '걷기']
const PACE_SPORTS = new Set(['러닝', '하이킹', '걷기'])
const MAX_HR_KEY = 'pacehub.live.maxHr'
// 심박 구간: 최대 심박 대비 %
const ZONES = [
  [0.6, 'Z1 회복'],
  [0.7, 'Z2 지구력'],
  [0.8, 'Z3 템포'],
  [0.9, 'Z4 역치'],
  [Infinity, 'Z5 최대'],
]

function readMaxHr() {
  try {
    return Number(localStorage.getItem(MAX_HR_KEY)) || 190
  } catch {
    return 190
  }
}

function localDate(ms) {
  const d = new Date(ms)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function downloadGpx(session, name) {
  const blob = new Blob([buildGpx(session.points, name)], { type: 'application/gpx+xml' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${localDate(session.started)}-${name.replace(/[^\w가-힣-]+/g, '_')}.gpx`
  link.click()
  URL.revokeObjectURL(url)
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

export default function LiveHud() {
  const navigate = useNavigate()
  const rec = useRecorder()
  const { session, setSession, recovery, setRecovery } = rec
  const [sport, setSport] = useState('바이크')
  const [maxHr, setMaxHr] = useState(readMaxHr)
  const [finishing, setFinishing] = useState(false)

  const active = session && session.status !== 'finished'
  const speedNow = session ? smoothSpeed(session.speeds, session.updated) : null
  const avgSpeed = session?.moving > 0 ? session.distance / 1000 / (session.moving / 3600) : null
  const usesPace = PACE_SPORTS.has(session?.sport ?? sport)
  const hrValues = (session?.hrSamples || []).map((s) => s.value)
  const zone = rec.heart ? ZONES.find(([limit]) => rec.heart.value / maxHr < limit)[1] : null

  // 지도는 점이 추가될 때마다 다시 그려지므로 5점마다만 갱신한다
  const routeKey = Math.floor((session?.points.length || 0) / 5)
  const latlng = useMemo(
    () => (session?.points || []).map((p) => [p.lat, p.lng]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [routeKey, session?.started],
  )

  function start() {
    setRecovery(null)
    setSession(createSession(sport))
  }
  function resume(recovered) {
    setRecovery(null)
    setSession(recovered)
  }
  function discardRecovery() {
    try {
      localStorage.removeItem(SESSION_KEY)
    } catch {
      /* 저장소가 막혀 있으면 지울 것도 없다 */
    }
    setRecovery(null)
  }
  function togglePause() {
    setSession((s) => ({
      ...s,
      status: s.status === 'paused' ? 'recording' : 'paused',
      slowSince: null,
    }))
  }
  function saveMaxHr(value) {
    setMaxHr(value)
    try {
      localStorage.setItem(MAX_HR_KEY, String(value))
    } catch {
      /* 다음에 기본값을 쓴다 */
    }
  }

  return (
    <div className="grid gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-label-caps text-label-caps text-primary-container">LIVE TRACKER</p>
          <h1 className="font-headline-lg text-headline-lg text-white">라이브 HUD</h1>
          <p className="text-on-surface-variant">
            휴대폰 GPS로 기록하고 끝나면 Strava에 올리거나 앱에 저장합니다.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge>
            <Icon name="satellite_alt" className="mr-1 text-[14px]" />
            {active ? rec.gps : 'GPS 대기'}
          </Badge>
          <Badge className="text-tertiary">
            <Icon name="favorite" className="mr-1 text-[14px]" />
            {rec.sensor}
          </Badge>
        </div>
      </header>

      {rec.error && <ErrorNotice message={rec.error} />}

      {!session && (
        <StartPanel
          sport={sport}
          setSport={setSport}
          onStart={start}
          recovery={recovery}
          onResume={resume}
          onDiscard={discardRecovery}
        />
      )}

      {session && (
        <>
          <section className="grid gap-5 xl:grid-cols-[minmax(0,3fr)_minmax(300px,2fr)]">
            <div className="rounded-xl bg-surface-container p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="flex items-center gap-2 font-label-caps text-label-caps text-on-surface-variant">
                  <SportIcon sport={session.sport} /> {session.sport} · REALTIME
                </p>
                <StatusBadge status={session.status} />
              </div>
              <p className="mt-4 font-metric-huge text-[clamp(56px,14vw,120px)] font-extrabold leading-none text-white">
                {usesPace
                  ? speedNow > 1
                    ? pace(3600 / speedNow)
                    : '--\'--"'
                  : speedNow != null
                    ? speedNow.toFixed(1)
                    : '0.0'}
                <span className="ml-2 font-metric-md text-metric-md text-on-surface-variant">
                  {usesPace ? '/km' : 'km/h'}
                </span>
              </p>
              <p className="mt-1 text-body-sm text-on-surface-variant">
                현재 {usesPace ? '페이스' : '속도'} (최근 5초 평균)
              </p>
              <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
                <Metric label="거리" value={(session.distance / 1000).toFixed(2)} unit="km" />
                <Metric label="경과 시간" value={clock(Math.round(session.elapsed))} />
                <Metric label="이동 시간" value={clock(Math.round(session.moving))} />
                <Metric
                  label={usesPace ? '평균 페이스' : '평균 속도'}
                  value={avgSpeed ? (usesPace ? pace(3600 / avgSpeed) : avgSpeed.toFixed(1)) : '—'}
                  unit={avgSpeed ? (usesPace ? '/km' : 'km/h') : ''}
                />
                <Metric label="고도 상승" value={`+${Math.round(session.gain)}`} unit="m" />
                <Metric
                  label="현재 랩"
                  value={clock(Math.round(session.moving - session.lapMoving))}
                  sub={`${((session.distance - session.lapDistance) / 1000).toFixed(2)} km · LAP ${session.laps.length + 1}`}
                />
              </div>
            </div>

            <Panel title="경로" subtitle="LIVE ROUTE">
              <RouteMap latlng={latlng} height={300} interactive />
              <p className="mt-2 text-body-sm text-on-surface-variant">
                기록된 위치 {number(session.points.length)}개
              </p>
            </Panel>
          </section>

          <section className="grid gap-5 lg:grid-cols-2">
            <HeartPanel
              heart={rec.heart}
              zone={zone}
              maxHr={maxHr}
              setMaxHr={saveMaxHr}
              connect={rec.connectHeart}
              avg={
                hrValues.length
                  ? Math.round(hrValues.reduce((a, b) => a + b, 0) / hrValues.length)
                  : null
              }
              max={hrValues.length ? Math.max(...hrValues) : null}
            />
            <Panel title="고도 프로파일" subtitle="ELEVATION">
              <ElevationChart points={session.points} />
            </Panel>
          </section>

          {session.laps.length > 0 && <LapTable laps={session.laps} usesPace={usesPace} />}

          <div className="sticky bottom-3 z-10 flex flex-wrap items-center justify-end gap-3 rounded-xl border border-surface-container-high bg-surface-container-low/95 p-3 backdrop-blur">
            <label className="mr-auto flex items-center gap-2 text-body-sm text-on-surface-variant">
              <input
                type="checkbox"
                checked={session.autoPause}
                onChange={(e) =>
                  setSession((s) => ({ ...s, autoPause: e.target.checked, slowSince: null }))
                }
              />
              자동 일시정지
            </label>
            <button
              className="secondary"
              disabled={session.status !== 'recording'}
              onClick={() => setSession(addLap)}
            >
              <Icon name="flag" className="mr-1 align-middle text-[18px]" />랩
            </button>
            <button className="secondary" onClick={togglePause}>
              <Icon
                name={session.status === 'paused' ? 'play_arrow' : 'pause'}
                className="mr-1 align-middle text-[18px]"
              />
              {session.status === 'paused' ? '재개' : '일시정지'}
            </button>
            <button
              className="button"
              onClick={() => {
                setSession((s) => ({ ...s, status: 'paused' }))
                setFinishing(true)
              }}
            >
              <Icon name="stop_circle" className="mr-1 align-middle text-[18px]" />
              종료
            </button>
          </div>
        </>
      )}

      {finishing && session && (
        <FinishDialog
          session={session}
          onCancel={() => setFinishing(false)}
          onDone={(path) => {
            try {
              localStorage.removeItem(SESSION_KEY)
            } catch {
              /* 무시 */
            }
            setSession({ ...session, status: 'finished' })
            navigate(path)
          }}
        />
      )}
    </div>
  )
}

function StatusBadge({ status }) {
  const [label, color] = {
    recording: ['● 기록 중', 'text-secondary-container'],
    autoPaused: ['자동 일시정지', 'text-primary'],
    paused: ['일시정지', 'text-primary'],
    finished: ['종료', 'text-on-surface-variant'],
  }[status]
  return (
    <span className={`font-label-caps text-label-caps ${color}`} role="status" aria-live="polite">
      {label}
    </span>
  )
}

function StartPanel({ sport, setSport, onStart, recovery, onResume, onDiscard }) {
  const supported = typeof navigator !== 'undefined' && 'geolocation' in navigator
  return (
    <Panel title="새 기록 시작" subtitle="SELECT ACTIVITY">
      {recovery && (
        <div className="mb-5 rounded-lg border border-primary-container/50 bg-surface-container-high p-4">
          <p className="text-white">
            끝내지 않은 기록이 있습니다: {recovery.sport} · {(recovery.distance / 1000).toFixed(2)}{' '}
            km · {clock(Math.round(recovery.moving))}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button className="button" onClick={() => onResume(recovery)}>
              이전 기록 이어하기
            </button>
            <button className="secondary" onClick={onDiscard}>
              버리기
            </button>
          </div>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" role="radiogroup" aria-label="종목">
        {LIVE_SPORTS.map((name) => (
          <button
            key={name}
            role="radio"
            aria-checked={sport === name}
            className={`flex flex-col items-center gap-2 rounded-xl border p-4 ${
              sport === name
                ? 'border-primary-container bg-surface-container-high text-white'
                : 'border-surface-container-high text-on-surface-variant'
            }`}
            onClick={() => setSport(name)}
          >
            <SportIcon sport={name} className="text-[32px]" />
            {name}
          </button>
        ))}
      </div>
      {!supported && (
        <p className="mt-4 text-error">이 브라우저는 위치 정보를 지원하지 않습니다.</p>
      )}
      <p className="mt-4 text-body-sm text-on-surface-variant">
        시작하면 위치 권한을 요청합니다. 기록 중에는 화면이 꺼지지 않게 하고, 몇 초마다 기기에 임시
        저장해 앱이 닫혀도 이어서 기록할 수 있습니다.
      </p>
      <button className="button mt-5 w-full sm:w-auto" disabled={!supported} onClick={onStart}>
        <Icon name="play_arrow" className="mr-1 align-middle" />
        {sport} 기록 시작
      </button>
    </Panel>
  )
}

function HeartPanel({ heart, zone, maxHr, setMaxHr, connect, avg, max }) {
  const supported = typeof navigator !== 'undefined' && 'bluetooth' in navigator
  return (
    <Panel
      title="심박 센서"
      subtitle="BLUETOOTH HEART RATE"
      actions={
        supported && (
          <button className="secondary" onClick={connect}>
            심박계 연결
          </button>
        )
      }
    >
      {!supported ? (
        <p className="text-on-surface-variant">
          이 브라우저는 블루투스 센서를 지원하지 않습니다 (Android·데스크톱 Chrome/Edge에서 가능).
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          <Metric label="현재" value={heart ? heart.value : '—'} unit="bpm" sub={zone} />
          <Metric label="평균" value={avg ?? '—'} unit="bpm" />
          <Metric label="최대" value={max ?? '—'} unit="bpm" />
        </div>
      )}
      <label className="mt-4 flex items-center gap-2 text-body-sm text-on-surface-variant">
        최대 심박
        <input
          type="number"
          min="120"
          max="230"
          value={maxHr}
          onChange={(e) => setMaxHr(Number(e.target.value) || 190)}
          className="w-20"
        />
        bpm (구간 계산용)
      </label>
    </Panel>
  )
}

function LapTable({ laps, usesPace }) {
  return (
    <Panel title="랩" subtitle={`LAPS · ${laps.length}`}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[360px] text-left">
          <thead className="font-label-caps text-label-caps text-on-surface-variant">
            <tr>
              <th className="py-2">랩</th>
              <th>거리</th>
              <th>시간</th>
              <th>{usesPace ? '페이스' : '속도'}</th>
            </tr>
          </thead>
          <tbody className="font-metric-md">
            {laps.map((lap, i) => {
              const kmh = lap.time > 0 ? lap.distance / 1000 / (lap.time / 3600) : 0
              return (
                <tr key={i} className="border-t border-surface-container-high">
                  <td className="py-2">{i + 1}</td>
                  <td>{(lap.distance / 1000).toFixed(2)} km</td>
                  <td>{clock(Math.round(lap.time))}</td>
                  <td>
                    {kmh > 0
                      ? usesPace
                        ? `${pace(3600 / kmh)} /km`
                        : `${kmh.toFixed(1)} km/h`
                      : '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </Panel>
  )
}

function FinishDialog({ session, onCancel, onDone }) {
  const dialog = useRef(null)
  const [name, setName] = useState(() => defaultName(session))
  const [memo, setMemo] = useState('')
  const [status, setStatus] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [statusText, setStatusText] = useState('')
  useEffect(() => {
    const node = dialog.current
    node.showModal()
    api('/strava/status')
      .then(setStatus)
      .catch(() => setStatus({ connected: false, can_upload: false }))
    return () => node.close()
  }, [])

  const hr = session.hrSamples.map((s) => s.value)
  const distanceKm = session.distance / 1000
  const enough = session.points.length >= 2

  async function uploadToStrava() {
    setBusy(true)
    setError('')
    try {
      const points = session.points.map(({ lat, lng, time, ele }) => ({ lat, lng, time, ele }))
      const upload = await api('/strava/upload', {
        method: 'POST',
        body: { name, sport: session.sport, description: memo, points },
      })
      // Strava가 파일을 처리하는 데 몇 초 걸린다 → 최대 60초 기다린다
      let activityId = upload.activity_id
      for (let i = 0; !activityId && i < 30; i += 1) {
        setStatusText(`Strava가 기록을 처리하는 중… (${(i + 1) * 2}초)`)
        await wait(2000)
        const state = await api(`/strava/upload/${upload.upload_id}`)
        if (state.error) throw new Error(`Strava 업로드 실패: ${state.error}`)
        activityId = state.activity_id
      }
      if (!activityId)
        throw new Error('Strava 처리가 늦어지고 있습니다. 잠시 후 연동 설정에서 동기화하세요.')
      setStatusText('앱으로 가져오는 중…')
      await syncAll(api)
      const workouts = await api('/workouts')
      const saved = workouts.find((w) => w.external_id === String(activityId))
      onDone(saved ? `/activities/${saved.id}` : '/')
    } catch (e) {
      setError(e.message)
      setBusy(false)
      setStatusText('')
    }
  }

  async function saveLocally() {
    if (distanceKm < 0.1) {
      setError('0.1 km 이상 이동해야 저장할 수 있습니다. GPX로 내보낼 수는 있습니다.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const track = simplifyPoints(session.points).map((p) => [p.lat, p.lng])
      const saved = await api('/workouts', {
        method: 'POST',
        body: {
          date: localDate(session.started),
          sport: session.sport,
          distance_km: Math.round(distanceKm * 100) / 100,
          duration_sec: Math.max(1, Math.round(session.moving || session.elapsed)),
          avg_hr: hr.length ? Math.round(hr.reduce((a, b) => a + b, 0) / hr.length) : null,
          max_hr: hr.length ? Math.max(...hr) : null,
          calories: null,
          memo,
          name,
          polyline: track.length >= 2 ? codec.encode(track) : null,
          elevation_gain_m: Math.round(session.gain),
          started_at: new Date(session.started).toISOString(),
        },
      })
      onDone(`/activities/${saved.id}`)
    } catch (e) {
      setError(e.message)
      setBusy(false)
    }
  }

  const canUpload = status?.connected && status?.can_upload
  return (
    <dialog
      ref={dialog}
      className="w-[min(520px,calc(100vw-32px))] rounded-xl border border-surface-container-high bg-surface-container p-6 text-on-surface"
      aria-label="기록 종료"
      onCancel={(e) => {
        e.preventDefault()
        if (!busy) onCancel()
      }}
    >
      <h2 className="font-headline-sm text-headline-sm text-white">기록 종료</h2>
      <p className="mt-1 text-on-surface-variant">
        {session.sport} · {distanceKm.toFixed(2)} km · 이동 {clock(Math.round(session.moving))} · +
        {Math.round(session.gain)} m
      </p>
      <label className="mt-4 grid gap-1">
        이름
        <input value={name} maxLength={200} onChange={(e) => setName(e.target.value)} />
      </label>
      <label className="mt-3 grid gap-1">
        메모
        <textarea
          rows="3"
          value={memo}
          maxLength={1000}
          onChange={(e) => setMemo(e.target.value)}
        />
      </label>

      {status?.connected && !status.can_upload && (
        <p className="mt-3 text-body-sm text-primary">
          Strava 업로드 권한이 없습니다. <Link to="/settings">연동 설정</Link>에서 연결을 해제한 뒤
          다시 연결하면 올릴 수 있습니다.
        </p>
      )}
      {status && !status.connected && (
        <p className="mt-3 text-body-sm text-on-surface-variant">
          Strava에 연결하면 기록을 바로 올릴 수 있습니다. 지금은 앱에만 저장됩니다.
        </p>
      )}
      {statusText && (
        <p className="mt-3 text-body-sm text-secondary-container" role="status">
          {statusText}
        </p>
      )}
      {error && <ErrorNotice message={error} />}

      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <button className="secondary" disabled={busy} onClick={onCancel}>
          계속 기록
        </button>
        <button
          className="secondary"
          disabled={busy || !enough}
          onClick={() => downloadGpx(session, name)}
        >
          GPX 내보내기
        </button>
        <button className="secondary" disabled={busy || !enough} onClick={saveLocally}>
          앱에만 저장
        </button>
        {canUpload && (
          <button className="button" disabled={busy || !enough} onClick={uploadToStrava}>
            Strava에 업로드
          </button>
        )}
      </div>
      {!enough && (
        <p className="mt-3 text-body-sm text-on-surface-variant">
          아직 기록된 위치가 없습니다. GPS 신호를 잡은 뒤 이동해 주세요.
        </p>
      )}
    </dialog>
  )
}
