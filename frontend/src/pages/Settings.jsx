import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { syncMessage } from '../lib/format'
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
      } else if (kind === 'sync') {
        const result = await api('/strava/sync', { method: 'POST' })
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
          <p className="eyebrow">기록을 한곳에</p>
          <h1>서비스 연동</h1>
          <p className="muted">Strava 활동과 기존 운동 기록을 가져오세요.</p>
        </div>
      </div>
      <div className="settings-grid">
        <section className="panel">
          <div className="card-heading">
            <h2>Strava 연동</h2>
            {status && <span className="badge">{status.connected ? '연결됨' : '연결 안 됨'}</span>}
          </div>
          <p className="muted">활동을 동기화하면 새로운 기록만 추가됩니다.</p>
          {!status && !error && <p role="status">연결 정보를 확인하고 있습니다…</p>}
          {status && (
            <>
              {!status.configured && (
                <p className="notice">서버에 Strava 앱 설정이 아직 없습니다</p>
              )}
              {status.connected ? (
                <>
                  <dl>
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
                    <button disabled={busy || !status.configured} onClick={() => action('sync')}>
                      {busy ? '처리 중…' : '지금 동기화'}
                    </button>
                    <button
                      className="secondary"
                      disabled={busy || !status.configured}
                      onClick={() => setConfirm(true)}
                    >
                      연결 해제
                    </button>
                  </div>
                  {confirm && (
                    <Confirm
                      message="Strava 연결을 해제할까요? 가져온 운동 기록은 유지됩니다."
                      busy={busy}
                      onConfirm={() => action('disconnect')}
                      onCancel={() => setConfirm(false)}
                    />
                  )}
                </>
              ) : (
                <button disabled={busy || !status.configured} onClick={() => action('connect')}>
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
            <button disabled={!file || csvBusy}>
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
