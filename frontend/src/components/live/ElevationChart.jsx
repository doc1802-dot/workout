import { useState } from 'react'

export default function ElevationChart({ points }) {
  const [selected, setSelected] = useState(null)
  const data = points.filter((p) => p.ele != null)
  if (!data.length)
    return <p className="text-on-surface-variant">기기에서 고도를 제공하면 그래프가 표시됩니다.</p>
  const min = Math.min(...data.map((p) => p.ele))
  const max = Math.max(...data.map((p) => p.ele))
  const distance = Math.max(1, points.at(-1)?.distance || 0)
  const x = (p) => 55 + (p.distance / distance) * 510
  const y = (p) => 140 - ((p.ele - min) / Math.max(1, max - min)) * 105
  const index = Math.min(selected ?? data.length - 1, data.length - 1)
  const point = data[index]
  const select = (event) => {
    const box = event.currentTarget.getBoundingClientRect()
    const target = ((((event.clientX - box.left) / box.width) * 600 - 55) / 510) * distance
    let nearest = 0
    data.forEach((p, i) => {
      if (Math.abs(p.distance - target) < Math.abs(data[nearest].distance - target)) nearest = i
    })
    setSelected(nearest)
  }
  return (
    <div>
      <p className="mb-2 font-metric-md text-primary" aria-live="polite">
        {(point.distance / 1000).toFixed(3)} km · {point.ele.toFixed(2)} m
      </p>
      <svg
        viewBox="0 0 600 180"
        width="100%"
        role="img"
        aria-label={`고도 ${min.toFixed(1)}~${max.toFixed(1)} m. 좌우 화살표로 측정값 탐색`}
        tabIndex={0}
        onPointerMove={select}
        onPointerDown={select}
        onKeyDown={(e) => {
          if (['ArrowLeft', 'ArrowRight'].includes(e.key)) {
            e.preventDefault()
            setSelected(
              Math.max(0, Math.min(data.length - 1, index + (e.key === 'ArrowRight' ? 1 : -1))),
            )
          }
        }}
      >
        <path d="M55 30V140H565" fill="none" className="stroke-surface-container-highest" />
        <text x="3" y="35" fontSize="12" fill="currentColor">
          {max.toFixed(0)} m
        </text>
        <text x="3" y="140" fontSize="12" fill="currentColor">
          {min.toFixed(0)} m
        </text>
        <text x="55" y="167" fontSize="12" fill="currentColor">
          0 km
        </text>
        <text x="565" y="167" textAnchor="end" fontSize="12" fill="currentColor">
          {(distance / 1000).toFixed(2)} km
        </text>
        <polyline
          points={data.map((p) => `${x(p)},${y(p)}`).join(' ')}
          fill="none"
          className="stroke-primary-container"
          strokeWidth="2"
        />
        <path
          d={`M${x(point)} 30V140`}
          className="stroke-secondary-container"
          strokeDasharray="4 4"
        />
        <circle cx={x(point)} cy={y(point)} r="4" className="fill-secondary-container" />
      </svg>
    </div>
  )
}
