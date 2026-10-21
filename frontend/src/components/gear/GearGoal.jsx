import { useState } from 'react'
import { Panel, ErrorNotice } from '../ui'
import { number } from '../../lib/format'

export default function GearGoal({ summary, userId }) {
  const [sport, setSport] = useState('러닝')
  const [revision, setRevision] = useState(0)
  const [error, setError] = useState('')
  const key = `pacehub:monthly-goal:${userId || 'local'}:${sport}`
  let goal = 200
  try {
    const saved = Number(localStorage.getItem(key))
    if (Number.isFinite(saved) && saved > 0) goal = saved
  } catch {
    /* Storage can be unavailable in private browser contexts. */
  }
  const current = summary.by_sport.find((row) => row.sport === sport)?.distance_km || 0
  const percent = Math.min(100, (current / goal) * 100)
  function save(event) {
    event.preventDefault()
    const value = Number(new FormData(event.currentTarget).get('goal'))
    if (!Number.isFinite(value) || value <= 0) return
    try {
      localStorage.setItem(key, String(value))
      setRevision((v) => v + 1)
      setError('')
    } catch {
      setError('브라우저에 목표를 저장할 수 없습니다.')
    }
  }
  return (
    <Panel title="이번 달 거리 목표" subtitle="MONTHLY GOAL · 이 브라우저에 저장">
      <label>
        종목
        <select
          value={sport}
          onChange={(e) => {
            setSport(e.target.value)
            setError('')
          }}
        >
          <option>러닝</option>
          <option>바이크</option>
        </select>
      </label>
      <div className="relative mx-auto my-5 w-full max-w-[220px]">
        <svg
          viewBox="0 0 200 200"
          width="100%"
          role="img"
          aria-label={`${sport} 이번 달 ${number(current)} km, 목표 ${number(goal)} km, ${number((current / goal) * 100)}% 달성`}
        >
          <circle
            cx="100"
            cy="100"
            r="80"
            fill="none"
            stroke="currentColor"
            strokeWidth="14"
            className="text-surface-container-high"
          />
          <circle
            cx="100"
            cy="100"
            r="80"
            pathLength="100"
            fill="none"
            stroke="currentColor"
            strokeWidth="14"
            strokeDasharray={`${percent} 100`}
            transform="rotate(-90 100 100)"
            className={sport === '러닝' ? 'text-primary-container' : 'text-secondary-container'}
          />
          <text
            x="100"
            y="95"
            textAnchor="middle"
            fill="currentColor"
            className="font-metric-lg text-metric-lg"
          >
            {number(current)}
          </text>
          <text x="100" y="120" textAnchor="middle" fill="currentColor" fontSize="12">
            / {number(goal)} km
          </text>
        </svg>
      </div>
      <p className="mb-4 text-center text-body-md text-on-surface-variant">
        {number((current / goal) * 100)}% 달성 ·{' '}
        {current >= goal ? '목표 달성!' : `${number(goal - current)} km 남음`}
      </p>
      <form key={`${key}:${revision}`} onSubmit={save} className="flex items-end gap-2">
        <label className="flex-1">
          목표 거리 (km)
          <input name="goal" type="number" min="0.1" step="0.1" required defaultValue={goal} />
        </label>
        <button type="submit">저장</button>
      </form>
      {error && <ErrorNotice message={error} />}
    </Panel>
  )
}
