import { useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { supabase } from './lib/supabase'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Workouts from './pages/Workouts'
import Settings from './pages/Settings'
import StravaCallback from './pages/StravaCallback'
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
      <Routes>
        <Route path="/login" element={<Login session={session} />} />
        <Route element={<Protected session={session} />}>
          <Route index element={<Dashboard />} />
          <Route path="workouts" element={<Workouts />} />
          <Route path="settings" element={<Settings />} />
          <Route path="strava/callback" element={<StravaCallback />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
