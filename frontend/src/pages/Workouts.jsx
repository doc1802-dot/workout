import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { sports, number, duration } from '../lib/format'
import WorkoutForm from '../components/WorkoutForm'
import Confirm from '../components/Confirm'
export default function Workouts() {
  const [filters, setFilters] = useState({ sport: '', date_from: '', date_to: '' })
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(undefined)
  const [deleting, setDeleting] = useState(null)
  const [busy, setBusy] = useState(false)
  const [version, setVersion] = useState(0)
  const invalidRange = filters.date_from && filters.date_to && filters.date_from > filters.date_to
  useEffect(() => {
    let active = true
    if (invalidRange) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    const query = new URLSearchParams(Object.entries(filters).filter(([, value]) => value))
    api(`/workouts?${query}`)
      .then((data) => {
        if (active) setRows(data)
      })
      .catch((error) => {
        if (active) setError(error.message)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [filters, version, invalidRange])
  async function remove() {
    setBusy(true)
    setError('')
    try {
      await api(`/workouts/${deleting.id}`, { method: 'DELETE' })
      setDeleting(null)
      setVersion((value) => value + 1)
    } catch (error) {
      setError(error.message)
    } finally {
      setBusy(false)
    }
  }
  const pair = (avg, max, unit) => `${avg ?? '—'} / ${max ?? '—'} ${unit}`
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="font-label-caps text-label-caps text-primary-container">나의 운동 일지</p>
          <h1>운동 기록</h1>
          <p className="muted">한 번의 움직임도 놓치지 않도록.</p>
        </div>
        <button
          className="button"
          onClick={() => {
            setEditing(null)
            setDeleting(null)
          }}
        >
          + 기록 추가
        </button>
      </div>
      {editing !== undefined && (
        <WorkoutForm
          key={editing?.id || 'new'}
          workout={editing}
          onCancel={() => setEditing(undefined)}
          onSaved={() => {
            setEditing(undefined)
            setVersion((value) => value + 1)
          }}
        />
      )}
      <section className="panel grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="기록 필터">
        <label>
          종목
          <select
            value={filters.sport}
            onChange={(event) => setFilters({ ...filters, sport: event.target.value })}
          >
            <option value="">전체 종목</option>
            {sports.map((sport) => (
              <option key={sport}>{sport}</option>
            ))}
          </select>
        </label>
        <label>
          시작일
          <input
            type="date"
            value={filters.date_from}
            onChange={(event) => setFilters({ ...filters, date_from: event.target.value })}
          />
        </label>
        <label>
          종료일
          <input
            type="date"
            value={filters.date_to}
            onChange={(event) => setFilters({ ...filters, date_to: event.target.value })}
          />
        </label>
        <button
          className="secondary"
          onClick={() => setFilters({ sport: '', date_from: '', date_to: '' })}
        >
          초기화
        </button>
      </section>
      {invalidRange && (
        <p className="notice error" role="alert">
          종료일은 시작일 이후로 선택하세요.
        </p>
      )}
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      {deleting && (
        <Confirm
          message={`${deleting.date} ${deleting.sport} 기록을 삭제할까요? 삭제한 기록은 복구할 수 없습니다.`}
          busy={busy}
          confirmLabel="삭제"
          onConfirm={remove}
          onCancel={() => setDeleting(null)}
        />
      )}
      {loading ? (
        <p className="loading" role="status">
          기록을 불러오고 있습니다…
        </p>
      ) : (
        !error &&
        !invalidRange &&
        (rows.length ? (
          <div
            className="min-w-0 max-w-full overflow-x-auto rounded-xl bg-surface-container"
            tabIndex={0}
            role="region"
            aria-label="?? ?? ?"
          >
            <table className="min-w-[1100px]">
              <caption className="p-4 text-left text-on-surface-variant">
                운동 기록 {rows.length}개 · 심박과 케이던스는 평균 / 최대
              </caption>
              <thead>
                <tr>
                  {[
                    '날짜',
                    '종목',
                    '이름 / 메모',
                    '거리',
                    '시간',
                    '요약',
                    '심박 평균 / 최대',
                    '케이던스 평균 / 최대',
                    '칼로리',
                    '출처',
                    '관리',
                  ].map((label) => (
                    <th key={label}>{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td data-label="날짜">{row.date}</td>
                    <td data-label="종목">
                      <span className="sport-badge">{row.sport}</span>
                    </td>
                    <td data-label="이름 / 메모" className="max-w-xs break-words">
                      <Link to={`/activities/${row.id}`} className="text-primary hover:underline">
                        {row.name || `${row.date} ${row.sport}`}
                      </Link>
                      {row.memo && (
                        <small className="mt-1 block text-on-surface-variant">{row.memo}</small>
                      )}
                    </td>
                    <td data-label="거리">{number(row.distance_km)} km</td>
                    <td data-label="시간">{duration(row.duration_sec)}</td>
                    <td data-label="요약">{row.summary}</td>
                    <td data-label="심박 평균 / 최대">{pair(row.avg_hr, row.max_hr, 'bpm')}</td>
                    <td data-label="케이던스 평균 / 최대">
                      {pair(row.avg_cad, row.max_cad, row.cadence_unit)}
                    </td>
                    <td data-label="칼로리">
                      {row.calories == null ? '—' : `${number(row.calories)} kcal`}
                    </td>
                    <td data-label="출처">
                      {row.source === 'strava' && row.external_id ? (
                        <a
                          className="rounded bg-surface-container-high px-2 py-1 text-primary"
                          href={`https://www.strava.com/activities/${row.external_id}`}
                          target="_blank"
                          rel="noreferrer"
                          aria-label="Strava에서 보기"
                        >
                          Strava
                        </a>
                      ) : (
                        <span className="rounded bg-surface-container-high px-2 py-1 text-primary">
                          {{ strava: 'Strava', manual: '직접', csv: 'CSV' }[row.source]}
                        </span>
                      )}
                    </td>
                    <td data-label="관리">
                      <div className="actions">
                        <button
                          className="quiet"
                          disabled={busy}
                          onClick={() => {
                            setEditing(row)
                            setDeleting(null)
                            window.scrollTo({ top: 0, behavior: 'smooth' })
                          }}
                        >
                          수정
                        </button>
                        <button
                          className="quiet text-error"
                          disabled={busy}
                          onClick={() => setDeleting(row)}
                        >
                          삭제
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="empty">저장된 기록이 없습니다.</p>
        ))
      )}
    </>
  )
}
