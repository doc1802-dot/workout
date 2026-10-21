export function achievements(workouts, month) {
  const rows = [...workouts].sort((a, b) => a.date.localeCompare(b.date))
  const single = (title, sport, target) => {
    const relevant = rows.filter((row) => row.sport === sport)
    return {
      title,
      target,
      value: Math.max(0, ...relevant.map((row) => Number(row.distance_km || 0))),
      date: relevant.find((row) => row.distance_km >= target)?.date,
      unit: 'km',
    }
  }
  const cumulative = (title, relevant, target) => {
    let value = 0
    let date
    for (const row of relevant) {
      value += Number(row.distance_km || 0)
      if (!date && value >= target) date = row.date
    }
    return { title, value, target, date, unit: 'km' }
  }
  let longest = 0
  let streak = 0
  let previous
  let streakDate
  for (const date of [...new Set(rows.map((row) => row.date))]) {
    const stamp = Date.parse(`${date}T00:00:00Z`)
    streak = stamp - previous === 86400000 ? streak + 1 : 1
    if (streak > longest) {
      longest = streak
      streakDate = date
    }
    previous = stamp
  }
  return [
    single('첫 100km 라이딩', '바이크', 100),
    single('하프 마라톤 거리 러닝', '러닝', 21.1),
    single('10km 러닝 완주', '러닝', 10),
    cumulative(
      '이번 달 100km',
      rows.filter((row) => row.date.startsWith(month)),
      100,
    ),
    cumulative('총 1,000km', rows, 1000),
    {
      title: '최장 연속 운동일 · 7일 도전',
      value: longest,
      target: 7,
      date: longest >= 7 ? streakDate : null,
      unit: '일',
    },
  ]
}
