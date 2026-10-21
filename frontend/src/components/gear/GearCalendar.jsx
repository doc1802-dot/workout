import { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import { number, today } from '../../lib/format'
import { Panel, ErrorNotice, Loading, Icon } from '../ui'

export default function GearCalendar() {
  const [month, setMonth] = useState(() => today().slice(0, 7))
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState(null)
  const [version, setVersion] = useState(0)
  const [year, monthNumber] = month.split('-').map(Number)
  useEffect(() => {
    let active = true
    setData(null)
    setError('')
    setSelected(null)
    api(`/stats/summary?year=${year}&month=${monthNumber}`)
      .then((data) => {
        if (active) setData(data)
      })
      .catch((error) => {
        if (active) setError(error.message)
      })
    return () => {
      active = false
    }
  }, [year, monthNumber, version])
  function shift(delta) {
    const date = new Date(year, monthNumber - 1 + delta, 1)
    setMonth(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`)
  }
  const buckets = data?.buckets || []
  const max = Math.max(1, ...buckets.map((day) => day.distance_km))
  const colors = [
    'bg-surface-container-high',
    'bg-primary-container/25',
    'bg-primary-container/50',
    'bg-primary-container/75',
    'bg-primary-container',
  ]
  const describe = (day) => `${day.key} · ${day.count}회 · ${number(day.distance_km)} km`
  return (
    <Panel
      title="월별 활동 빈도"
      subtitle="ACTIVITY HEATMAP · DISTANCE (KM)"
      actions={
        <div className="flex items-center gap-3">
          <button className="secondary !p-2" aria-label="이전 달" onClick={() => shift(-1)}>
            <Icon name="chevron_left" />
          </button>
          <span className="font-label-caps">{month}</span>
          <button className="secondary !p-2" aria-label="다음 달" onClick={() => shift(1)}>
            <Icon name="chevron_right" />
          </button>
        </div>
      }
    >
      {error ? (
        <ErrorNotice message={error} onRetry={() => setVersion((v) => v + 1)} />
      ) : !data ? (
        <Loading />
      ) : (
        <>
          <div className="mx-auto grid max-w-xl grid-cols-7 gap-2 text-center text-body-sm">
            {'일월화수목금토'.split('').map((day) => (
              <span key={day} className="py-2 text-on-surface-variant">
                {day}
              </span>
            ))}
            {Array.from({ length: new Date(year, monthNumber - 1, 1).getDay() }, (_, i) => (
              <span key={`empty-${i}`} />
            ))}
            {buckets.map((day, index) => (
              <button
                key={day.key}
                aria-label={describe(day)}
                title={describe(day)}
                onClick={() => setSelected(day)}
                onFocus={() => setSelected(day)}
                onMouseEnter={() => setSelected(day)}
                className={`aspect-square min-h-8 rounded-lg font-label-caps ${colors[day.distance_km > 0 ? Math.max(1, Math.ceil((day.distance_km / max) * 4)) : 0]}`}
              >
                {index + 1}
              </button>
            ))}
          </div>
          <p className="mt-4 min-h-5 text-body-sm text-on-surface-variant" role="status">
            {selected ? describe(selected) : '날짜를 선택하면 활동 횟수와 거리가 표시됩니다.'}
          </p>
          <div className="mt-3 flex flex-wrap items-center justify-end gap-2 text-body-sm">
            <span>0 km</span>
            {colors.map((color) => (
              <span key={color} className={`h-3 w-5 rounded ${color}`} />
            ))}
            <span>
              {number(Math.max(0, ...buckets.map((day) => day.distance_km)))} km (월 최대)
            </span>
          </div>
        </>
      )}
    </Panel>
  )
}
