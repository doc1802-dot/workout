import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { clearSession } from '../lib/live/recorder'
import { api } from '../lib/api'
import { ErrorNotice, Icon } from './ui'
const navigation = [
  ['/', '피드', 'Feed', 'dynamic_feed'],
  ['/analytics', '활동 분석', 'Analytics', 'query_stats'],
  ['/live', '라이브 HUD', 'Live Tracker', 'speed'],
  ['/gear', '기어 & 통계', 'My Gear & Stats', 'directions_bike'],
  ['/segments', '세그먼트', 'Segments', 'military_tech'],
  ['/workouts', '기록 관리', 'Records', 'edit_note'],
  ['/settings', '연동 설정', 'Settings', 'settings'],
]
function Navigation({ onNavigate, compact = false }) {
  return (
    <nav
      aria-label={compact ? '주 메뉴' : '텔레메트리 메뉴'}
      className={compact ? 'flex gap-1' : 'grid gap-1'}
    >
      {navigation.slice(0, compact ? 5 : navigation.length).map(([to, ko, en, icon]) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          onClick={onNavigate}
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-lg px-3 py-3 text-body-md ${isActive ? 'bg-surface-container-high text-primary-container' : 'text-on-surface-variant hover:bg-surface-container'}`
          }
        >
          {!compact && <Icon name={icon} />}
          <span>
            {ko}
            <span
              className={
                compact
                  ? 'block text-label-sensor'
                  : 'ml-2 text-label-sensor text-on-surface-variant'
              }
            >
              {en}
            </span>
          </span>
        </NavLink>
      ))}
    </nav>
  )
}
// Layout accepts the authenticated Supabase session and renders nested routes.
export default function Layout({ session }) {
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [strava, setStrava] = useState(null)
  const [statusError, setStatusError] = useState('')
  const drawer = useRef(null)
  const location = useLocation()
  useEffect(() => {
    let active = true
    api('/strava/status')
      .then((data) => {
        if (active) {
          setStrava(data)
          setStatusError('')
        }
      })
      .catch(() => {
        if (active) setStatusError('연결 상태 확인 실패')
      })
    return () => {
      active = false
    }
  }, [location.pathname])
  async function logout() {
    setBusy(true)
    try {
      clearSession() // 이 브라우저에 남은 라이브 기록은 로그아웃할 때 지운다
      const { error } = await supabase.auth.signOut()
      if (error) throw error
    } catch (error) {
      setError(error.message)
    } finally {
      setBusy(false)
    }
  }
  const sidebar = (
    <>
      <p className="mb-4 px-3 font-label-caps text-label-caps text-on-surface-variant">
        TELEMETRY NODES
      </p>
      <Navigation onNavigate={() => drawer.current?.close()} />
      <p className="mb-3 mt-10 px-3 font-label-caps text-label-caps text-on-surface-variant">
        HARDWARE LINKS
      </p>
      <Link
        to="/settings"
        onClick={() => drawer.current?.close()}
        className="mx-2 flex items-center gap-3 rounded-lg bg-surface-container-lowest p-3 text-body-sm"
      >
        <Icon name="sensors" className="text-tertiary" />
        <span className="min-w-0 break-words">
          Strava
          <br />
          <span className="text-on-surface-variant">
            {statusError ||
              (strava
                ? strava.connected
                  ? `연결됨${strava.athlete_name ? ` · ${strava.athlete_name}` : ''}`
                  : '연결 안 됨'
                : '확인 중…')}
          </span>
        </span>
      </Link>
    </>
  )
  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-20 focus:z-50 focus:bg-background focus:p-3"
      >
        본문으로 건너뛰기
      </a>
      <header className="fixed inset-x-0 top-0 z-40 flex h-16 items-center justify-between gap-3 border-b border-surface-container-high bg-surface-container-lowest/95 px-4 backdrop-blur-xl lg:px-6">
        <div className="flex items-center gap-3">
          <button
            className="p-1 lg:hidden"
            aria-label="메뉴 열기"
            onClick={() => drawer.current.showModal()}
          >
            <Icon name="menu" />
          </button>
          <Link to="/" className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-container text-white">
              <Icon name="bolt" />
            </span>
            <span>
              <span className="block font-headline-sm text-xl font-bold leading-none text-white">
                PACE<span className="text-primary-container">HUB</span>
              </span>
              <span className="font-label-sensor text-label-sensor text-on-surface-variant">
                TELEMETRY CORE
              </span>
            </span>
          </Link>
        </div>
        <div className="hidden xl:block">
          <Navigation compact />
        </div>
        <details className="relative">
          <summary
            className="flex cursor-pointer list-none items-center gap-2 rounded-lg p-2"
            aria-label="사용자 메뉴"
          >
            <Icon name="account_circle" className="text-primary" />
            <span className="hidden max-w-40 truncate text-body-sm sm:block">
              {session.user.email}
            </span>
            <Icon name="expand_more" />
          </summary>
          <div className="absolute right-0 top-full mt-2 w-64 max-w-[85vw] rounded-xl border border-surface-container-highest bg-surface-container p-4 shadow-xl">
            <p className="mb-3 break-all text-body-sm">{session.user.email}</p>
            <button className="secondary w-full" disabled={busy} onClick={logout}>
              {busy ? '로그아웃 중…' : '로그아웃'}
            </button>
          </div>
        </details>
      </header>
      <aside className="fixed bottom-0 left-0 top-16 hidden w-64 overflow-y-auto border-r border-surface-container-high bg-surface-container-low px-2 py-6 lg:block">
        {sidebar}
      </aside>
      <dialog
        ref={drawer}
        aria-label="내비게이션"
        className="m-0 h-dvh max-h-dvh w-80 max-w-[90vw] rounded-none bg-surface-container-low p-4"
      >
        <div className="mb-6 flex justify-end">
          <button aria-label="메뉴 닫기" onClick={() => drawer.current.close()}>
            <Icon name="close" />
          </button>
        </div>
        {sidebar}
      </dialog>
      <main id="main-content" className="min-w-0 px-4 pb-10 pt-24 sm:px-6 lg:ml-64 lg:px-8">
        <div className="mx-auto max-w-[1440px]">
          {error && <ErrorNotice message={error} />}
          <Outlet />
        </div>
      </main>
    </>
  )
}
