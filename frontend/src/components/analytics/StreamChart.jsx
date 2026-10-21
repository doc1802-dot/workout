import { useId, useState } from 'react'

const gradeColor = (grade) =>
  grade == null
    ? '#ff571b'
    : grade < 3
      ? '#4edea3'
      : grade < 6
        ? '#c3f400'
        : grade < 10
          ? '#ff571b'
          : '#ffb4ab'

export default function StreamChart({ distance, values, grade, label, unit, onHover }) {
  const gradient = useId()
  const [selected, setSelected] = useState(null)
  const points = (distance || []).flatMap((x, index) =>
    Number.isFinite(x) && Number.isFinite(values?.[index]) ? [{ x, y: values[index], index }] : [],
  )
  if (!points.length) return <p className="text-on-surface-variant">차트 데이터가 없습니다.</p>
  const xmin = Math.min(...points.map((p) => p.x))
  const xmax = Math.max(...points.map((p) => p.x))
  const ymin = Math.min(...points.map((p) => p.y))
  const ymax = Math.max(...points.map((p) => p.y))
  const x = (value) => 65 + ((value - xmin) / (xmax - xmin || 1)) * 600
  const y = (value) => 210 - ((value - ymin) / (ymax - ymin || 1)) * 175
  const active = points.find((p) => p.index === selected)
  const choose = (point) => {
    setSelected(point?.index ?? null)
    onHover?.(point?.index ?? null)
  }
  const scrub = (event) => {
    const bounds = event.currentTarget.getBoundingClientRect()
    const target =
      xmin + ((((event.clientX - bounds.left) / bounds.width) * 700 - 65) / 600) * (xmax - xmin)
    choose(
      points.reduce((best, point) =>
        Math.abs(point.x - target) < Math.abs(best.x - target) ? point : best,
      ),
    )
  }
  const path = points.map((p) => `${x(p.x)},${y(p.y)}`).join(' ')
  return (
    <div className="min-w-0">
      <svg
        viewBox="0 0 700 260"
        width="100%"
        role="img"
        aria-label={`${label}: 거리 ${xmin}~${xmax} km, ${ymin}~${ymax} ${unit}. 좌우 화살표로 값 탐색`}
        tabIndex={0}
        className="touch-pan-y rounded bg-surface-container-lowest"
        onPointerMove={scrub}
        onPointerDown={scrub}
        onPointerLeave={(event) => {
          if (event.pointerType === 'mouse') choose(null)
        }}
        onBlur={() => choose(null)}
        onKeyDown={(event) => {
          if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
          event.preventDefault()
          const current = points.findIndex((p) => p.index === selected)
          const next =
            event.key === 'Home'
              ? 0
              : event.key === 'End'
                ? points.length - 1
                : current + (event.key === 'ArrowRight' ? 1 : -1)
          choose(points[Math.max(0, Math.min(points.length - 1, next))])
        }}
      >
        <defs>
          <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
            <stop stopColor="#ff571b" stopOpacity="0.35" />
            <stop offset="1" stopColor="#ff571b" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {[0, 0.5, 1].map((ratio) => {
          const value = ymin + (ymax - ymin) * ratio
          return (
            <g key={ratio}>
              <line x1="65" x2="665" y1={y(value)} y2={y(value)} stroke="#30353e" />
              <text x="58" y={y(value) + 4} textAnchor="end" fill="#e6beb2" fontSize="12">
                {Number(value.toFixed(1))}
              </text>
            </g>
          )
        })}
        <text x="12" y="18" fill="#e6beb2" fontSize="12">
          {unit}
        </text>
        <polygon
          points={`${x(points[0].x)},210 ${path} ${x(points.at(-1).x)},210`}
          fill={`url(#${gradient})`}
        />
        {points.slice(1).map((p, i) => (
          <line
            key={p.index}
            x1={x(points[i].x)}
            y1={y(points[i].y)}
            x2={x(p.x)}
            y2={y(p.y)}
            stroke={gradeColor(grade?.[p.index])}
            strokeWidth="2.5"
          />
        ))}
        {points.length === 1 && (
          <circle cx={x(points[0].x)} cy={y(points[0].y)} r="4" fill="#ff571b" />
        )}
        {[0, 0.5, 1].map((ratio) => (
          <text
            key={ratio}
            x={65 + ratio * 600}
            y="241"
            textAnchor="middle"
            fill="#e6beb2"
            fontSize="12"
          >
            {Number((xmin + (xmax - xmin) * ratio).toFixed(2))} km
          </text>
        ))}
        {active && (
          <g>
            <line
              x1={x(active.x)}
              x2={x(active.x)}
              y1="25"
              y2="210"
              stroke="#dee2ee"
              strokeDasharray="4 4"
            />
            <circle
              cx={x(active.x)}
              cy={y(active.y)}
              r="5"
              fill="#c3f400"
              stroke="#090e16"
              strokeWidth="2"
            />
          </g>
        )}
      </svg>
      <p
        className="mt-3 min-h-10 break-words font-label-caps text-body-sm text-on-surface"
        aria-live="polite"
      >
        {active
          ? `${active.x} km · ${label} ${active.y} ${unit}${Number.isFinite(grade?.[active.index]) ? ` · 경사 ${grade[active.index]}%` : ''}`
          : '차트를 터치하거나 마우스를 올려 상세 값을 확인하세요. 키보드: ← →'}
      </p>
      {grade?.some(Number.isFinite) && (
        <div className="flex flex-wrap gap-3 text-body-sm" aria-label="경사도 범례">
          {[
            ['3% 미만', '#4edea3'],
            ['3~6%', '#c3f400'],
            ['6~10%', '#ff571b'],
            ['10% 이상', '#ffb4ab'],
          ].map(([text, color]) => (
            <span key={text}>
              <i className="mr-1 inline-block h-2 w-2 rounded-full" style={{ background: color }} />
              {text}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
