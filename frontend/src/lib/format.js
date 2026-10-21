export const sports = ['러닝', '바이크', '하이킹', '걷기', '수영', '기타']
export const number = (value) =>
  Number(value || 0).toLocaleString('ko-KR', { maximumFractionDigits: 2 })
export const duration = (seconds) =>
  [Math.floor(seconds / 3600), Math.floor((seconds % 3600) / 60), seconds % 60]
    .map((n) => String(n).padStart(2, '0'))
    .join(':')
export const today = () => {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

// Strava 동기화를 남은 활동이 없을 때까지 이어서 부른다 (한 번에 최대 500개씩).
// 처음 연결하면 몇 년 치 기록을 한꺼번에 가져와야 하므로 버튼을 여러 번 누르지 않게 한다.
export async function syncAll(api, onProgress, maxRounds = 20) {
  const total = { fetched: 0, imported: 0, has_more: false, last_synced_at: null }
  for (let round = 0; round < maxRounds; round += 1) {
    const result = await api('/strava/sync', { method: 'POST' })
    total.fetched += result.fetched
    total.imported += result.imported
    total.has_more = result.has_more
    total.last_synced_at = result.last_synced_at
    onProgress?.(total)
    if (!result.has_more) break
  }
  return total
}

// Strava 동기화 결과 문구
export const syncMessage = (result) =>
  `${result.fetched}개 가져옴 / 새로 추가 ${result.imported}개` +
  (result.has_more ? ' · 남은 활동이 더 있습니다. 한 번 더 동기화하세요.' : '')

export const pace = (secPerKm) => {
  if (secPerKm == null || !Number.isFinite(Number(secPerKm)) || secPerKm < 0) return '—'
  const seconds = Math.round(secPerKm)
  return `${Math.floor(seconds / 60)}'${String(seconds % 60).padStart(2, '0')}"`
}
export const speed = (kmh) =>
  kmh == null || !Number.isFinite(Number(kmh)) ? '—' : Number(kmh).toFixed(1)
export const clock = (sec) => {
  if (sec == null || !Number.isFinite(Number(sec)) || sec < 0) return '—'
  const seconds = Math.round(sec)
  const minutes = Math.floor(seconds / 60)
  return `${minutes >= 60 ? `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}` : minutes}:${String(seconds % 60).padStart(2, '0')}`
}
const localDate = (value) => new Date(value?.length === 10 ? `${value}T00:00:00` : value)
export const dateLabel = (isoDate) => {
  const date = localDate(isoDate)
  if (Number.isNaN(date.getTime())) return '날짜 없음'
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일 (${'일월화수목금토'[date.getDay()]})`
}
export const relativeDay = (isoDate) => {
  const date = localDate(isoDate)
  if (Number.isNaN(date.getTime())) return '날짜 없음'
  const now = new Date()
  const days = Math.round(
    (Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) -
      Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())) /
      86400000,
  )
  if (days === 0) return '오늘'
  if (days === 1) return '어제'
  if (days > 1 && days < 7) return `${days}일 전`
  return dateLabel(isoDate)
}
