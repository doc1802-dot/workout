import { useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
export default function Login({ session }) {
  const location = useLocation()
  const [signup, setSignup] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  if (session) return <Navigate to={location.state?.from || '/'} replace />
  async function submit(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const credentials = { email: form.get('email'), password: form.get('password') }
      const { data, error } = signup
        ? await supabase.auth.signUp({
            ...credentials,
            options: { emailRedirectTo: window.location.origin },
          })
        : await supabase.auth.signInWithPassword(credentials)
      if (error) throw error
      if (signup && !data.session)
        setMessage('가입 확인 메일을 보냈습니다. 메일의 링크를 누른 뒤 로그인하세요.')
    } catch (error) {
      setError(error.message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <main className="login-wrap">
      <section className="panel login-panel">
        <div className="brand">↗ 운동기록</div>
        <h1>
          오늘의 움직임을
          <br />
          기록해 보세요.
        </h1>
        <p className="muted">러닝부터 라이딩까지, 쌓여가는 나의 변화.</p>
        <div className="toggle">
          <button
            className={!signup ? 'selected' : ''}
            disabled={busy}
            onClick={() => {
              setSignup(false)
              setError('')
              setMessage('')
            }}
          >
            로그인
          </button>
          <button
            className={signup ? 'selected' : ''}
            disabled={busy}
            onClick={() => {
              setSignup(true)
              setError('')
              setMessage('')
            }}
          >
            회원가입
          </button>
        </div>
        <form onSubmit={submit} className="stack">
          <label>
            이메일
            <input name="email" type="email" autoComplete="email" required />
          </label>
          <label>
            비밀번호
            <input
              name="password"
              type="password"
              minLength={6}
              autoComplete={signup ? 'new-password' : 'current-password'}
              required
            />
          </label>
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
          <button disabled={busy}>{busy ? '처리 중…' : signup ? '회원가입' : '로그인'}</button>
        </form>
      </section>
    </main>
  )
}
