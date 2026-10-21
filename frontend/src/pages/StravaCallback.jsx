import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../lib/api'
import { syncAll, syncMessage } from '../lib/format'
export default function StravaCallback() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const started = useRef(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('Strava 연결을 완료하고 있습니다…')
  useEffect(() => {
    // StrictMode에서도 인증 코드는 한 번만 교환합니다.
    if (started.current) return
    started.current = true
    const code = params.get('code')
    if (params.get('error')) {
      setError('Strava 연결이 취소되었거나 승인되지 않았습니다.')
      return
    }
    if (!code) {
      setError('Strava 인증 코드가 없습니다. 연동 화면에서 다시 연결해 주세요.')
      return
    }
    async function connect() {
      try {
        // state: 연결을 시작한 사용자가 맞는지 서버가 확인하는 서명값
        const state = params.get('state') || ''
        await api('/strava/exchange', {
          method: 'POST',
          body: { code, state, scope: params.get('scope') },
        })
        setMessage('연결되었습니다. 운동 기록을 동기화하고 있습니다…')
        const result = await syncAll(api, (progress) =>
          setMessage(`연결되었습니다. 운동 기록을 가져오는 중… (${progress.fetched}개)`),
        )
        navigate('/settings', {
          replace: true,
          state: {
            message: `Strava 연결 완료 · ${syncMessage(result)}`,
          },
        })
      } catch (error) {
        setError(error.message)
      }
    }
    connect()
  }, [params, navigate])
  return (
    <section className="mx-auto max-w-xl rounded-xl border-t-4 border-primary-container bg-surface-container p-6 sm:p-10">
      <p className="mb-3 font-label-caps text-label-caps text-primary-container">
        STRAVA CONNECTION
      </p>
      <h1>Strava 연결</h1>
      {error ? (
        <>
          <p className="notice error" role="alert">
            {error}
          </p>
          <Link className="secondary mt-4" to="/settings">
            연동 화면으로 돌아가기
          </Link>
        </>
      ) : (
        <p className="mt-5 text-on-surface-variant" role="status">
          {message}
        </p>
      )}
    </section>
  )
}
