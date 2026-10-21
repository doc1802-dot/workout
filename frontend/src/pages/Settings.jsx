import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { number, syncAll, syncMessage } from '../lib/format'
import { Badge, Metric } from '../components/ui'
import Confirm from '../components/Confirm'
export default function Settings() {
  const location = useLocation()
  const navigate = useNavigate()
  const [status, setStatus] = useState(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState(location.state?.message || '')
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [file, setFile] = useState(null)
  const [csvBusy, setCsvBusy] = useState(false)
  const [csvError, setCsvError] = useState('')
  const [csvMessage, setCsvMessage] = useState('')
  const [stravaWorkouts, setStravaWorkouts] = useState([])
  const [workoutsLoading, setWorkoutsLoading] = useState(true)
  const [workoutsError, setWorkoutsError] = useState('')
  const latestActivityDate = stravaWorkouts.reduce(
    (latest, workout) => (workout.date > latest ? workout.date : latest),
    '',
  )
  const totalDistance = stravaWorkouts.reduce(
    (total, workout) => total + Number(workout.distance_km || 0),
    0,
  )
  useEffect(() => {
    let active = true
    api('/workouts')
      .then((data) => {
        if (active) setStravaWorkouts(data.filter((workout) => workout.source === 'strava'))
      })
      .catch((error) => {
        if (active) setWorkoutsError(error.message)
      })
      .finally(() => {
        if (active) setWorkoutsLoading(false)
      })
    return () => {
      active = false
    }
  }, [])
  useEffect(() => {
    let active = true
    api('/strava/status')
      .then((data) => {
        if (active) setStatus(data)
      })
      .catch((error) => {
        if (active) setError(error.message)
      })
    return () => {
      active = false
    }
  }, [])
  useEffect(() => {
    if (location.state?.message) navigate('/settings', { replace: true, state: null })
  }, [location.state, navigate])
  async function action(kind) {
    setBusy(true)
    setError('')
    setMessage('')
    try {
      if (kind === 'connect') {
        const query = new URLSearchParams({
          redirect_uri: `${window.location.origin}/strava/callback`,
        })
        const { url } = await api(`/strava/authorize-url?${query}`)
        window.location.href = url
      } else if (kind === 'resync') {
        await api('/strava/resync', { method: 'POST' })
        let fetched = 0
        let result
        // 한 번에 최대 500개씩 → 활동 1만 개까지 (무한 반복 방지)
        for (let round = 0; round < 20; round += 1) {
          result = await api('/strava/sync?update=true', { method: 'POST' })
          fetched += result.fetched
          setMessage(`Strava 기록을 다시 가져오는 중… (${number(fetched)}개)`)
          if (!result.has_more) break
        }
        setMessage(`전체 다시 가져오기 완료 · ${number(fetched)}개 활동을 갱신했습니다.`)
        setStatus((current) => ({ ...current, last_synced_at: result.last_synced_at }))
        setConfirm(false)
      } else if (kind === 'sync') {
        const result = await syncAll(api, (progress) =>
          setMessage(`운동 기록을 가져오는 중… (${progress.fetched}개)`),
        )
        setMessage(syncMessage(result))
        setStatus((current) => ({ ...current, last_synced_at: result.last_synced_at }))
      } else {
        await api('/strava/connection', { method: 'DELETE' })
        setStatus((current) => ({
          ...current,
          connected: false,
          athlete_name: null,
          last_synced_at: null,
        }))
        setConfirm(false)
        setMessage('Strava 연결을 해제했습니다.')
      }
      if (kind === 'sync' || kind === 'resync') {
        try {
          const rows = await api('/workouts')
          setStravaWorkouts(rows.filter((row) => row.source === 'strava'))
          setWorkoutsError('')
        } catch (refreshError) {
          setWorkoutsError(refreshError.message)
        }
      }
    } catch (error) {
      setError(error.message)
    } finally {
      setBusy(false)
    }
  }
  async function importCsv(event) {
    event.preventDefault()
    if (!file) return
    setCsvBusy(true)
    setCsvError('')
    setCsvMessage('')
    try {
      const body = new FormData()
      body.append('file', file)
      const result = await api('/import/csv', { method: 'POST', body })
      setCsvMessage(`${result.imported}개 가져옴 / ${result.skipped}개 건너뜀`)
    } catch (error) {
      setCsvError(error.message)
    } finally {
      setCsvBusy(false)
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="font-label-caps text-label-caps text-primary-container">기록을 한곳에</p>
          <h1>서비스 연동</h1>
          <p className="muted">Strava 활동과 기존 운동 기록을 가져오세요.</p>
        </div>
      </div>
      <section className="panel">
        <h2>Strava 기록 현황</h2>
        <p className="muted">
          내 Strava 계정을 연결하면 내 활동만 가져옵니다. 이미 가져온 활동은 다시 저장하지 않습니다.
        </p>
        {workoutsLoading ? (
          <p role="status">Strava 기록을 불러오고 있습니다…</p>
        ) : workoutsError ? (
          <p className="notice error" role="alert">
            {workoutsError}
          </p>
        ) : (
          <div className="mt-6 grid gap-5 sm:grid-cols-3">
            <Metric label="동기화된 활동" value={number(stravaWorkouts.length)} unit="개" />
            <Metric label="총 거리" value={number(totalDistance)} unit="km" />
            <div>
              <p className="font-label-caps text-label-caps text-on-surface-variant">최근 활동</p>
              <p className="mt-3 font-metric-md">{latestActivityDate || '활동 기록 없음'}</p>
            </div>
          </div>
        )}
      </section>
      <div className="grid min-w-0 gap-5 xl:grid-cols-2">
        <section className="panel">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2>Strava 연동</h2>
            {status && <span className="badge">{status.connected ? '연결됨' : '연결 안 됨'}</span>}
          </div>
          <p className="muted">활동을 동기화하면 새로운 기록만 추가됩니다.</p>
          {!status && !error && <p role="status">연결 정보를 확인하고 있습니다…</p>}
          {status && (
            <>
              {!status.configured && (
                <p className="notice">
                  Strava 연동이 아직 준비되지 않았습니다. 관리자가 Strava API 키를 등록하면 연결할
                  수 있습니다.
                </p>
              )}
              {status.connected ? (
                <>
                  <dl className="mt-5 grid gap-2 rounded-lg bg-surface-container-lowest p-4">
                    <dt>운동선수</dt>
                    <dd>{status.athlete_name || '이름 없음'}</dd>
                    <dt>마지막 동기화</dt>
                    <dd>
                      {status.last_synced_at
                        ? new Date(status.last_synced_at).toLocaleString('ko-KR')
                        : '동기화한 기록이 없습니다.'}
                    </dd>
                  </dl>
                  <div className="actions">
                    <button
                      className="button"
                      disabled={busy || !status.configured}
                      onClick={() => action('sync')}
                    >
                      {busy ? '처리 중…' : '지금 동기화'}
                    </button>
                    <button
                      className="secondary"
                      disabled={busy || !status.configured}
                      onClick={() => setConfirm('disconnect')}
                    >
                      연결 해제
                    </button>
                  </div>
                  {status.can_upload === false && (
                    <p className="notice">
                      라이브 기록을 Strava에 올리려면 연결을 해제한 뒤 다시 연결하세요 (업로드 권한
                      추가).
                    </p>
                  )}
                  <div className="mt-6 border-t border-surface-container-highest pt-5">
                    <p className="mb-3 text-body-md text-on-surface-variant">
                      이미 가져온 기록에도 지도·응원 수·최고 속도를 채웁니다. 직접 쓴 메모는 그대로
                      둡니다.
                    </p>
                    <button
                      className="secondary"
                      disabled={busy || !status.configured}
                      onClick={() => setConfirm('resync')}
                    >
                      Strava 전체 다시 가져오기
                    </button>
                  </div>
                  {confirm && (
                    <Confirm
                      message={
                        confirm === 'resync'
                          ? 'Strava의 모든 활동을 처음부터 다시 받아 기존 기록을 갱신할까요? 활동이 많으면 1분 정도 걸립니다.'
                          : 'Strava 연결을 해제할까요? 가져온 운동 기록은 유지됩니다.'
                      }
                      busy={busy}
                      confirmLabel={confirm === 'resync' ? '다시 가져오기' : '연결 해제'}
                      onConfirm={() => action(confirm)}
                      onCancel={() => setConfirm(false)}
                    />
                  )}
                </>
              ) : (
                <button
                  className="button"
                  disabled={busy || !status.configured}
                  onClick={() => action('connect')}
                >
                  {busy ? '연결 중…' : 'Strava 연결'}
                </button>
              )}
            </>
          )}
          {error && (
            <p className="notice error" role="alert">
              {error}
            </p>
          )}
          {message && (
            <p className="notice" role="status">
              {message}
            </p>
          )}
        </section>
        <section className="panel">
          <h2>CSV 가져오기</h2>
          <p className="muted">기존 records.csv 파일의 운동 기록을 불러옵니다.</p>
          <form className="stack" onSubmit={importCsv}>
            <label className="file-field">
              CSV 파일
              <input
                type="file"
                accept=".csv"
                required
                disabled={csvBusy}
                onChange={(event) => {
                  setFile(event.target.files[0] || null)
                  setCsvMessage('')
                  setCsvError('')
                }}
              />
            </label>
            <button type="submit" disabled={!file || csvBusy}>
              {csvBusy ? '가져오는 중…' : '기록 가져오기'}
            </button>
          </form>
          {csvError && (
            <p className="notice error" role="alert">
              {csvError}
            </p>
          )}
          {csvMessage && (
            <p className="notice" role="status">
              {csvMessage}
            </p>
          )}
        </section>
      </div>
    </>
  )
}
