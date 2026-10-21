import { Badge, Panel } from '../ui'
import { clock, number, pace, speed } from '../../lib/format'

export default function SplitTable({ rows, bike, laps = false }) {
  const speeds = rows.map(
    (row) =>
      row.speed_kmh ??
      (row.pace_sec_per_km > 0
        ? 3600 / row.pace_sec_per_km
        : row.moving_sec > 0
          ? (row.distance_km / row.moving_sec) * 3600
          : null),
  )
  const valid = speeds.filter((value) => Number.isFinite(value) && value > 0)
  const fastest = Math.max(...valid)
  const slowest = Math.min(...valid)
  return (
    <Panel
      title={laps ? '랩 기록' : '1KM 오토 스플릿'}
      subtitle={laps ? 'LAPS' : 'AUTO SPLITS · 막대는 최고 속도 대비 비율'}
      className="min-w-0"
    >
      {!rows.length ? (
        <p className="text-on-surface-variant">스플릿 데이터가 없습니다.</p>
      ) : (
        <div
          className="max-w-full overflow-x-auto"
          tabIndex={0}
          role="region"
          aria-label={laps ? '랩 기록 표' : '스플릿 표'}
        >
          <table className="whitespace-nowrap">
            <thead>
              <tr>
                {[
                  '구간',
                  '거리 (km)',
                  '이동 시간',
                  bike ? '속도 (km/h)' : '페이스 (/km)',
                  laps ? '평균 파워 (W)' : '고도 차 (m)',
                  '평균 심박 (bpm)',
                ].map((label) => (
                  <th key={label} scope="col">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => {
                const velocity = speeds[index]
                const best = velocity > 0 && velocity === fastest
                const worst = velocity > 0 && velocity === slowest && slowest < fastest
                return (
                  <tr
                    key={`${row.index}-${index}`}
                    className={
                      best ? 'bg-secondary-container/10' : worst ? 'bg-primary-container/10' : ''
                    }
                  >
                    <th scope="row">
                      {row.name || row.index || index + 1}{' '}
                      {best && <Badge className="!text-secondary-container">최고</Badge>}
                      {worst && <Badge>최저</Badge>}
                    </th>
                    <td>{row.distance_km == null ? '—' : number(row.distance_km)}</td>
                    <td>{clock(row.moving_sec ?? row.elapsed_sec)}</td>
                    <td className="min-w-40 font-metric-md text-body-md">
                      {velocity == null
                        ? '—'
                        : bike
                          ? speed(velocity)
                          : pace(row.pace_sec_per_km ?? (velocity > 0 ? 3600 / velocity : null))}
                      <div className="mt-2 h-1 rounded bg-surface-container-highest">
                        <div
                          className={
                            best ? 'h-full bg-secondary-container' : 'h-full bg-primary-container'
                          }
                          style={{ width: `${velocity > 0 ? (velocity / fastest) * 100 : 0}%` }}
                        />
                      </div>
                    </td>
                    <td>
                      {(laps ? row.avg_watts : row.elevation_diff_m) == null
                        ? '—'
                        : number(laps ? row.avg_watts : row.elevation_diff_m)}
                    </td>
                    <td>{row.avg_hr == null ? '—' : number(row.avg_hr)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  )
}
