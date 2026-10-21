import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { sports, today } from '../lib/format'
const optional = ['avg_hr', 'max_hr', 'avg_cad', 'max_cad', 'calories']
function values(workout) {
  return {
    date: workout?.date || today(),
    sport: workout?.sport || '러닝',
    distance_km: workout?.distance_km ?? '',
    duration_sec: workout?.duration_sec ?? 0,
    ...Object.fromEntries(optional.map((key) => [key, workout?.[key] ?? null])),
    memo: workout?.memo ?? '',
  }
}
// WorkoutForm accepts workout (optional), onSaved and onCancel; creates or patches via API.
export default function WorkoutForm({ workout, onSaved, onCancel }) {
  const [initial] = useState(() => values(workout))
  const [form, setForm] = useState(initial)
  const [time, setTime] = useState({
    hours: Math.floor(initial.duration_sec / 3600),
    minutes: Math.floor((initial.duration_sec % 3600) / 60),
    seconds: initial.duration_sec % 60,
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  // 새 기록이고 Strava 업로드 권한이 있으면 "Strava에도 올리기"를 보여준다 (기본 켜짐)
  const [canUpload, setCanUpload] = useState(false)
  const [toStrava, setToStrava] = useState(true)
  const [saved, setSaved] = useState(false)
  useEffect(() => {
    if (workout) return
    let active = true
    api('/strava/status')
      .then((s) => active && setCanUpload(Boolean(s.connected && s.can_upload)))
      .catch(() => {})
    return () => {
      active = false
    }
  }, [workout])
  const change = (key, value) => setForm((current) => ({ ...current, [key]: value }))
  async function submit(event) {
    event.preventDefault()
    setError('')
    const payload = {
      ...form,
      distance_km: form.distance_km === '' ? null : Number(form.distance_km),
      duration_sec: Number(time.hours) * 3600 + Number(time.minutes) * 60 + Number(time.seconds),
      ...Object.fromEntries(
        optional.map((key) => [
          key,
          form[key] === '' || form[key] === null ? null : Number(form[key]),
        ]),
      ),
    }
    // Strava의 근력운동처럼 거리 0인 기록은 거리를 안 바꾸면 그대로 둘 수 있다
    const distanceChanged = !workout || payload.distance_km !== initial.distance_km
    if (distanceChanged && (!Number.isFinite(payload.distance_km) || payload.distance_km < 0.1))
      return setError('거리는 0.1 km 이상 입력하세요.')
    if (!Number.isInteger(payload.duration_sec) || payload.duration_sec < 1)
      return setError('운동 시간은 1초 이상 입력하세요.')
    if (
      Object.values(time).some((value) => !Number.isInteger(Number(value)) || Number(value) < 0) ||
      Number(time.minutes) > 59 ||
      Number(time.seconds) > 59
    )
      return setError('시간을 올바르게 입력하세요. 분과 초는 0~59입니다.')
    if (
      optional.some(
        (key) => payload[key] !== null && (!Number.isInteger(payload[key]) || payload[key] < 0),
      )
    )
      return setError('심박, 케이던스, 칼로리는 0 이상의 정수를 입력하세요.')
    const body = workout
      ? Object.fromEntries(Object.entries(payload).filter(([key, value]) => value !== initial[key]))
      : payload
    if (workout && !Object.keys(body).length) {
      onCancel()
      return
    }
    setBusy(true)
    let created = null
    try {
      created = await api(workout ? `/workouts/${workout.id}` : '/workouts', {
        method: workout ? 'PATCH' : 'POST',
        body,
      })
      if (!workout && canUpload && toStrava) {
        await api(`/workouts/${created.id}/strava`, { method: 'POST' })
      }
      onSaved()
    } catch (error) {
      if (created && !workout) {
        // 기록은 저장됐고 Strava 업로드만 실패 → 다시 저장하면 중복되므로 닫기만 하게 한다
        setSaved(true)
        setError(
          `기록은 저장했지만 Strava 업로드에 실패했습니다: ${error.message} (활동 상세에서 다시 올릴 수 있습니다)`,
        )
      } else {
        setError(error.message)
      }
    } finally {
      setBusy(false)
    }
  }
  const numeric = (key, label) => (
    <label key={key}>
      {label}
      <input
        type="number"
        min="0"
        step="1"
        value={form[key] ?? ''}
        onChange={(event) => change(key, event.target.value)}
        placeholder="선택"
      />
    </label>
  )
  return (
    <section className="rounded-xl bg-surface-container p-1 sm:p-5" aria-labelledby="form-title">
      <h2 id="form-title">{workout ? '기록 수정' : '새로운 운동 기록'}</h2>
      <form onSubmit={submit}>
        <fieldset disabled={busy}>
          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label>
              날짜
              <input
                type="date"
                value={form.date}
                required
                onChange={(event) => change('date', event.target.value)}
              />
            </label>
            <label>
              종목
              <select value={form.sport} onChange={(event) => change('sport', event.target.value)}>
                {sports.map((sport) => (
                  <option key={sport}>{sport}</option>
                ))}
              </select>
            </label>
            <label>
              거리 (km)
              <input
                type="number"
                min={workout ? '0' : '0.1'}
                step="0.01"
                value={form.distance_km}
                required
                onChange={(event) => change('distance_km', event.target.value)}
              />
            </label>
            <div className="min-w-0">
              <span>운동 시간</span>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {[
                  ['hours', '시'],
                  ['minutes', '분'],
                  ['seconds', '초'],
                ].map(([key, label]) => (
                  <label key={key}>
                    <input
                      type="number"
                      min="0"
                      max={key === 'hours' ? undefined : 59}
                      step="1"
                      value={time[key]}
                      onChange={(event) => setTime({ ...time, [key]: event.target.value })}
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>
            {numeric('avg_hr', '평균 심박 (bpm)')}
            {numeric('max_hr', '최대 심박 (bpm)')}
            {numeric('avg_cad', `평균 케이던스 (${form.sport === '바이크' ? 'rpm' : 'spm'})`)}
            {numeric('max_cad', `최대 케이던스 (${form.sport === '바이크' ? 'rpm' : 'spm'})`)}
            {numeric('calories', '칼로리 (kcal)')}
            <label className="sm:col-span-2">
              메모
              <textarea
                rows="3"
                value={form.memo}
                onChange={(event) => change('memo', event.target.value)}
              />
            </label>
          </div>
          {error && (
            <p className="notice error" role="alert">
              {error}
            </p>
          )}
          {!workout && canUpload && (
            <label className="mt-4 flex items-center gap-2 text-body-md">
              <input
                type="checkbox"
                checked={toStrava}
                onChange={(event) => setToStrava(event.target.checked)}
              />
              Strava에도 올리기 (수동 활동으로 만들어집니다)
            </label>
          )}
          <div className="actions">
            {saved ? (
              <button type="button" onClick={onSaved}>
                닫기
              </button>
            ) : (
              <button type="submit">{busy ? '저장 중…' : '기록 저장'}</button>
            )}
            <button type="button" className="secondary" onClick={onCancel}>
              취소
            </button>
          </div>
        </fieldset>
      </form>
    </section>
  )
}
