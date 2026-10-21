import { lazy, Suspense, useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { supabase } from './lib/supabase'
import Layout from './components/Layout'
import Login from './pages/Login'
import Feed from './pages/Feed'
import { Loading } from './components/ui'
// 피드 말고는 처음 열 때 불러온다 (지도·그래프 코드가 첫 화면을 무겁게 하지 않게)
const Dashboard = lazy(() => import('./pages/Dashboard'))
const ActivityDetail = lazy(() => import('./pages/ActivityDetail'))
const LiveHud = lazy(() => import('./pages/LiveHud'))
const GearStats = lazy(() => import('./pages/GearStats'))
const Segments = lazy(() => import('./pages/Segments'))
const Workouts = lazy(() => import('./pages/Workouts'))
const Settings = lazy(() => import('./pages/Settings'))
const StravaCallback = lazy(() => import('./pages/StravaCallback'))
function Protected({ session }) {
  const location = useLocation()
  return session ? (
    <Layout session={session} />
  ) : (
    <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  )
}
export default function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, next) => {
      if (active) {
        setSession(next)
        setLoading(false)
      }
    })
    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (active) {
          setSession(data.session)
          setError(error?.message || '')
          setLoading(false)
        }
      })
      .catch((error) => {
        if (active) {
          setError(error.message)
          setLoading(false)
        }
      })
    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])
  if (loading)
    return (
      <p className="loading" role="status">
        로그인 정보를 확인하고 있습니다…
      </p>
    )
  return (
    <BrowserRouter>
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route path="/login" element={<Login session={session} />} />
          <Route element={<Protected session={session} />}>
            <Route index element={<Feed />} />
            <Route path="analytics" element={<Dashboard />} />
            <Route path="activities/:id" element={<ActivityDetail />} />
            <Route path="live" element={<LiveHud />} />
            <Route path="gear" element={<GearStats />} />
            <Route path="segments" element={<Segments />} />
            <Route path="workouts" element={<Workouts />} />
            <Route path="settings" element={<Settings />} />
            <Route path="strava/callback" element={<StravaCallback />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
