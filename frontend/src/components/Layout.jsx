import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { supabase } from '../lib/supabase'
export default function Layout({ session }) {
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function logout() {
    setBusy(true)
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
    } catch (error) {
      setError(error.message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <header className="header">
        <div className="header-inner">
          <NavLink className="brand" to="/">
            ↗ 운동기록
          </NavLink>
          <nav aria-label="주 메뉴">
            <NavLink to="/" end>
              대시보드
            </NavLink>
            <NavLink to="/workouts">기록</NavLink>
            <NavLink to="/settings">연동</NavLink>
          </nav>
          <div className="account">
            <span title={session.user.email}>{session.user.email}</span>
            <button className="quiet" disabled={busy} onClick={logout}>
              로그아웃
            </button>
          </div>
        </div>
      </header>
      <main className="container">
        {error && (
          <p className="notice error" role="alert">
            {error}
          </p>
        )}
        <Outlet />
      </main>
      <footer>하루의 움직임이, 나의 기록이 됩니다.</footer>
    </>
  )
}
