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

// Strava 동기화 결과 문구
export const syncMessage = (result) =>
  `${result.fetched}개 가져옴 / 새로 추가 ${result.imported}개` +
  (result.has_more ? ' · 남은 활동이 더 있습니다. 한 번 더 동기화하세요.' : '')
