import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { number, clock } from '../lib/format'
import { Panel, Badge, EmptyState, ErrorNotice, Loading } from '../components/ui'
import SportIcon from '../components/SportIcon'

export default function Segments() {
  const [status, setStatus] = useState(null)
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [sort, setSort] = useState('distance_km')
  const [version, setVersion] = useState(0)
  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    async function load() {
      try {
        const state = await api('/strava/status')
        if (active) setStatus(state)
        if (state.connected) {
          const data = await api('/strava/segments')
          if (active) setRows(data.segments)
        }
      } catch (error) {
        if (active) setError(error.message)
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => {
      active = false
    }
  }, [version])
  const sorted = [...rows].sort((a, b) => {
    if (a[sort] == null) return b[sort] == null ? 0 : 1
    if (b[sort] == null) return -1
    return sort === 'pr_elapsed_sec' ? a[sort] - b[sort] : b[sort] - a[sort]
  })
  const value = (n, unit = '') => (n == null ? '—' : `${number(n)}${unit}`)
  return (
    <div className="min-w-0 space-y-6">
      <header>
        <p className="mb-2 font-label-caps text-label-caps text-primary-container">
          STARRED SEGMENTS
        </p>
        <h1>나의 세그먼트</h1>
        <p className="mt-2 text-on-surface-variant">별표한 구간과 나의 최고 기록을 확인하세요.</p>
      </header>
      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorNotice message={error} onRetry={() => setVersion((v) => v + 1)} />
      ) : !status?.connected ? (
        <EmptyState
          title="Strava 연결이 필요합니다"
          description="계정을 연결하면 별표한 세그먼트를 가져옵니다."
          actions={
            <Link className="button" to="/settings">
              Strava 연결하기
            </Link>
          }
        />
      ) : !rows.length ? (
        <EmptyState
          title="Strava에서 별표한 세그먼트가 없습니다"
          actions={
            <a
              className="button mt-4"
              href="https://www.strava.com/segments/explore"
              target="_blank"
              rel="noreferrer"
            >
              Strava 세그먼트 탐색
            </a>
          }
        />
      ) : (
        <Panel
          title="즐겨찾는 구간"
          subtitle={`${rows.length} STARRED SEGMENTS`}
          actions={
            <label>
              정렬
              <select value={sort} onChange={(e) => setSort(e.target.value)}>
                <option value="distance_km">거리 · 긴 순</option>
                <option value="avg_grade">평균 경사 · 높은 순</option>
                <option value="pr_elapsed_sec">PR · 짧은 순</option>
              </select>
            </label>
          }
        >
          <div
            className="max-w-full overflow-x-auto"
            tabIndex={0}
            role="region"
            aria-label="세그먼트 기록 표"
          >
            <table className="min-w-[900px]">
              <thead>
                <tr>
                  {[
                    '세그먼트',
                    '거리',
                    '경사 평균 / 최대',
                    '고도 최저 / 최고',
                    '등급',
                    '내 PR / 날짜',
                    '시도',
                  ].map((label) => (
                    <th key={label} scope="col">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map((row) => (
                  <tr key={row.id} className="hover:bg-surface-container-high">
                    <td>
                      <div className="flex items-center gap-3">
                        <SportIcon
                          sport={
                            row.activity_type === 'Ride'
                              ? '바이크'
                              : row.activity_type === 'Run'
                                ? '러닝'
                                : '기타'
                          }
                        />
                        <div>
                          <a
                            className="text-primary hover:underline"
                            href={row.url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {row.name}
                          </a>
                          <p className="mt-1 text-body-sm text-on-surface-variant">
                            {row.activity_type}
                            {row.city ? ` · ${row.city}` : ''}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="font-metric-md">{value(row.distance_km, ' km')}</td>
                    <td>
                      {value(row.avg_grade, '%')} / {value(row.max_grade, '%')}
                    </td>
                    <td>
                      {value(row.elev_low, ' m')} / {value(row.elev_high, ' m')}
                    </td>
                    <td>
                      <Badge>
                        {row.climb_category === 0 ? '등급 없음' : value(row.climb_category)}
                      </Badge>
                    </td>
                    <td>
                      <span className="font-metric-md text-secondary-container">
                        {clock(row.pr_elapsed_sec)}
                      </span>
                      <p className="mt-1 text-body-sm text-on-surface-variant">
                        {row.pr_date || 'PR 기록 없음'}
                      </p>
                    </td>
                    <td>{value(row.effort_count, '회')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </div>
  )
}
