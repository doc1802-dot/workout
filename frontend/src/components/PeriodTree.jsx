import { useEffect, useId, useState } from 'react'
import { api } from '../lib/api'
import { number } from '../lib/format'

function usePeriods(sport, year, enabled) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    if (!enabled || data) return
    let active = true
    const params = new URLSearchParams()
    if (sport) params.set('sport', sport)
    if (year) params.set('year', year)
    setError('')
    api(`/stats/summary${params.size ? `?${params}` : ''}`)
      .then((result) => {
        if (active) setData(result)
      })
      .catch((error) => {
        if (active) setError(error.message)
      })
    return () => {
      active = false
    }
  }, [sport, year, enabled, data, retry])

  return { data, error, retry: () => setRetry((value) => value + 1) }
}

function RequestStatus({ request }) {
  if (request.error) {
    return (
      <div className="notice error" role="alert">
        <p>{request.error}</p>
        <button type="button" className="secondary" onClick={request.retry}>
          다시 불러오기
        </button>
      </div>
    )
  }
  return (
    !request.data && (
      <p className="muted" role="status">
        불러오는 중…
      </p>
    )
  )
}

function PeriodRow({ bucket, max, sport, sportColor, change, toggle }) {
  const [year, month] = bucket.key.split('-').map(Number)
  return (
    <div className={`period-tree-row${month ? ' period-tree-month' : ''}`}>
      {toggle}
      <button
        type="button"
        className="secondary period-tree-label"
        onClick={() => change({ scope: month ? 'month' : 'year', year, month: month || 1 })}
      >
        {bucket.label}
      </button>
      <div className="bar-track stacked-track" aria-hidden="true">
        {(sport ? [[sport, bucket.distance_km]] : Object.entries(bucket.by_sport || {})).map(
          ([name, distance]) => (
            <div
              className="bar"
              key={name}
              style={{ width: `${(distance / max) * 100}%`, background: sportColor(name) }}
            />
          ),
        )}
      </div>
      <span className="period-tree-value">
        {number(bucket.distance_km)} km · {number(bucket.count)}회
      </span>
    </div>
  )
}

const maxDistance = (rows) => Math.max(0, ...rows.map((row) => row.distance_km)) || 1
const newestFirst = (rows) =>
  rows.filter((row) => row.count > 0).sort((a, b) => b.key.localeCompare(a.key))

function YearRow({ bucket, max, sport, sportColor, change, visible }) {
  const [expanded, setExpanded] = useState(false)
  const id = useId()
  const year = Number(bucket.key)
  const request = usePeriods(sport, year, visible && expanded)
  const now = new Date()
  const months = newestFirst(request.data?.buckets || []).filter(
    (row) => year !== now.getFullYear() || Number(row.key.split('-')[1]) <= now.getMonth() + 1,
  )

  return (
    <li>
      <PeriodRow
        {...{ bucket, max, sport, sportColor, change }}
        toggle={
          <button
            type="button"
            className="secondary period-tree-toggle"
            aria-expanded={expanded}
            aria-controls={id}
            aria-label={`${year}년 월별 기록 ${expanded ? '접기' : '펼치기'}`}
            onClick={() => setExpanded((value) => !value)}
          >
            {expanded ? '−' : '+'}
          </button>
        }
      />
      <div id={id} hidden={!expanded} className="period-tree-months">
        <RequestStatus request={request} />
        {request.data && !months.length && <p className="empty">저장된 기록이 없습니다.</p>}
        <ul className="period-tree-list">
          {months.map((month) => (
            <li key={month.key}>
              <PeriodRow
                bucket={month}
                max={maxDistance(months)}
                {...{ sport, sportColor, change }}
              />
            </li>
          ))}
        </ul>
      </div>
    </li>
  )
}

function YearList({ expanded, sport, sportColor, change }) {
  const request = usePeriods(sport, null, expanded)
  const years = newestFirst(request.data?.buckets || [])
  return (
    <>
      <RequestStatus request={request} />
      {!sport && request.data && (
        <div className="chart-legend" aria-label="종목별 색상">
          {(request.data.by_sport || [])
            .filter((item) => item.count > 0)
            .map((item) => (
              <span key={item.sport}>
                <i className="sport-dot" style={{ background: sportColor(item.sport) }} />
                {item.sport}
              </span>
            ))}
        </div>
      )}
      {request.data && !years.length && <p className="empty">저장된 기록이 없습니다.</p>}
      <ul className="period-tree-list">
        {years.map((bucket) => (
          <YearRow
            key={bucket.key}
            bucket={bucket}
            max={maxDistance(years)}
            visible={expanded}
            {...{ sport, sportColor, change }}
          />
        ))}
      </ul>
    </>
  )
}

export default function PeriodTree({ sport, sportColor, change }) {
  const [expanded, setExpanded] = useState(false)
  const id = useId()
  return (
    <section className="panel period-tree">
      <div className="period-tree-heading">
        <h2>기간별 기록</h2>
        <button
          type="button"
          className="secondary"
          aria-expanded={expanded}
          aria-controls={id}
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? '접기 ▴' : '연도별 기록 보기 ▾'}
        </button>
      </div>
      <div id={id} hidden={!expanded}>
        <YearList key={sport} {...{ expanded, sport, sportColor, change }} />
      </div>
    </section>
  )
}
