import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { number } from '../lib/format'
export default function Dashboard() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    Promise.all([api('/stats/total'), api('/stats/monthly'), api('/stats/pr')])
      .then(([total, monthly, pr]) => {
        if (active) setData({ total, monthly, pr })
      })
      .catch((error) => {
        if (active) setError(error.message)
      })
    return () => {
      active = false
    }
  }, [])
  if (error)
    return (
      <p className="notice error" role="alert">
        {error}
      </p>
    )
  if (!data)
    return (
      <p className="loading" role="status">
        운동 기록을 불러오고 있습니다…
      </p>
    )
  const { total, monthly, pr } = data
  const max = Math.max(1, ...monthly.map((month) => month.distance_km))
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">나의 운동 한눈에</p>
          <h1>작은 기록, 꾸준한 변화</h1>
          <p className="muted">지금까지 달리고 움직인 시간을 만나보세요.</p>
        </div>
        <Link className="button" to="/workouts">
          기록 보러 가기 ↗
        </Link>
      </div>
      {!total.count && <p className="empty">저장된 기록이 없습니다.</p>}
      <div className="stats-grid">
        {[
          ['기록 수', `${number(total.count)}회`],
          ['총 거리', `${number(total.distance_km)} km`],
          [
            '총 시간',
            `${Math.floor(total.duration_sec / 3600)}시간 ${Math.floor((total.duration_sec % 3600) / 60)}분`,
          ],
          ['총 칼로리', `${number(total.calories)} kcal`],
        ].map(([label, value]) => (
          <section className="panel stat" key={label}>
            <p>{label}</p>
            <strong>{value}</strong>
          </section>
        ))}
      </div>
      <section className="panel">
        <h2>종목별 거리</h2>
        <div className="sport-totals">
          {Object.entries(total.by_sport).map(([sport, distance]) => (
            <div key={sport}>
              <span>{sport}</span>
              <strong>
                {number(distance)} <small>km</small>
              </strong>
            </div>
          ))}
          {!Object.keys(total.by_sport).length && <p className="muted">저장된 기록이 없습니다.</p>}
        </div>
      </section>
      <section className="panel">
        <h2>월별 운동</h2>
        <p className="muted">매달 쌓아온 거리와 기록 수</p>
        {monthly.length ? (
          <div className="chart">
            {monthly.map((month) => (
              <div className="chart-row" key={month.month}>
                <span>{month.month}</span>
                <div className="bar-track">
                  <div className="bar" style={{ width: `${(month.distance_km / max) * 100}%` }} />
                </div>
                <span>
                  {number(month.distance_km)} km · {number(month.count)}회
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="empty">저장된 기록이 없습니다.</p>
        )}
      </section>
      <h2 className="section-heading">나의 최고 기록</h2>
      <div className="pr-grid">
        {[
          ['best_run', '러닝 최고 페이스'],
          ['best_bike', '바이크 최고 속도'],
          ['longest', '최장 거리'],
        ].map(([key, label]) => (
          <section className="panel pr" key={key}>
            <span className="eyebrow">{label}</span>
            {pr[key] ? (
              <>
                <h3>{key === 'longest' ? `${number(pr[key].distance_km)} km` : pr[key].summary}</h3>
                {key === 'longest' && <p>{pr[key].summary}</p>}
                <p className="muted">
                  {pr[key].date} · {pr[key].sport}
                </p>
              </>
            ) : (
              <p className="muted">아직 기록이 없습니다.</p>
            )}
          </section>
        ))}
      </div>
    </>
  )
}
