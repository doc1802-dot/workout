export const SESSION_KEY = 'pacehub.live.v1'
export function haversine(a, b) {
  const rad = Math.PI / 180
  const h =
    Math.sin(((b.lat - a.lat) * rad) / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(((b.lng - a.lng) * rad) / 2) ** 2
  return 6371000 * 2 * Math.asin(Math.sqrt(Math.min(1, h)))
}
export function createSession(sport, now = Date.now()) {
  return {
    version: 1,
    sport,
    started: now,
    updated: now,
    elapsed: 0,
    moving: 0,
    distance: 0,
    gain: 0,
    altitudeAnchor: null,
    points: [],
    laps: [],
    lapMoving: 0,
    lapDistance: 0,
    status: 'recording',
    autoPause: true,
    slowSince: null,
    lastFix: null,
    speeds: [],
    hrSamples: [],
  }
}
export function smoothSpeed(samples, now) {
  const recent = samples.filter((s) => now - s.time <= 5000)
  return recent.length ? recent.reduce((sum, s) => sum + s.speed, 0) / recent.length : null
}
export function tick(s, now) {
  if (!s || s.status === 'finished') return s
  const dt = Math.max(0, (now - s.updated) / 1000)
  const velocity = smoothSpeed(s.speeds, now)
  const moving = s.status === 'recording' && velocity != null && velocity >= 1.5
  return {
    ...s,
    updated: now,
    elapsed: s.elapsed + dt,
    moving: s.moving + (moving ? Math.min(dt, 5) : 0),
  }
}
export function autoPause(s, speed, now) {
  if (!s.autoPause || s.status === 'paused' || s.status === 'finished') return s
  if (speed >= 1.5) return { ...s, slowSince: null, status: 'recording' }
  const slowSince = s.slowSince ?? now
  return { ...s, slowSince, status: now - slowSince >= 6000 ? 'autoPaused' : s.status }
}
export function acceptPosition(session, position, hr = null) {
  const c = position.coords
  const now = position.timestamp
  if (
    !Number.isFinite(c.accuracy) ||
    c.accuracy > 35 ||
    !Number.isFinite(c.latitude) ||
    !Number.isFinite(c.longitude) ||
    Math.abs(c.latitude) > 90 ||
    Math.abs(c.longitude) > 180
  )
    return session
  let s = tick(session, Math.max(session.updated, now))
  const p = {
    lat: c.latitude,
    lng: c.longitude,
    time: new Date(now).toISOString(),
    ele: Number.isFinite(c.altitude) ? c.altitude : null,
    hr,
    timestamp: now,
  }
  const previous = s.lastFix
  const dt = previous ? (now - previous.timestamp) / 1000 : 0
  if (previous && dt <= 0) return session
  const meters = previous ? haversine(previous, p) : 0
  const velocity = dt > 0 ? (meters / dt) * 3.6 : 0
  if (velocity > 120) return session
  const measured = Number.isFinite(c.speed) && c.speed >= 0 ? c.speed * 3.6 : velocity
  if (measured > 120) return session
  s = autoPause(s, measured, now)
  s = {
    ...s,
    lastFix: p,
    speeds: [...s.speeds.filter((v) => now - v.time < 5000), { time: now, speed: measured }],
  }
  if (s.status !== 'recording') return s
  // Never bridge a manual pause, recovery gap, or lost GPS interval.
  const last = s.points.at(-1)
  const continuous = previous && last?.timestamp === previous.timestamp && dt <= 15
  if (continuous) s.distance += meters
  if (p.ele != null) {
    if (s.altitudeAnchor == null || !continuous) s.altitudeAnchor = p.ele
    const delta = p.ele - s.altitudeAnchor
    if (Math.abs(delta) >= 3) {
      s.gain += Math.max(0, delta)
      s.altitudeAnchor = p.ele
    }
  }
  p.distance = s.distance
  p.segmentStart = !continuous
  return { ...s, points: [...s.points, p] }
}
export function addLap(s) {
  return {
    ...s,
    laps: [...s.laps, { time: s.moving - s.lapMoving, distance: s.distance - s.lapDistance }],
    lapMoving: s.moving,
    lapDistance: s.distance,
  }
}
export function persistSession(s, storage = localStorage) {
  storage.setItem(SESSION_KEY, JSON.stringify(s))
}
export function readSession(storage = localStorage) {
  try {
    const s = JSON.parse(storage.getItem(SESSION_KEY))
    if (
      s?.version !== 1 ||
      !Array.isArray(s.points) ||
      !Array.isArray(s.laps) ||
      !Number.isFinite(s.started) ||
      !Number.isFinite(s.moving)
    )
      return null
    return {
      ...s,
      status: s.status === 'finished' ? 'finished' : 'paused',
      updated: Date.now(),
      lastFix: null,
      speeds: [],
      slowSince: null,
    }
  } catch {
    return null
  }
}
export function simplifyPoints(points, max = 2000) {
  if (points.length <= max) return points
  return Array.from(
    { length: max },
    (_, i) => points[Math.round((i * (points.length - 1)) / (max - 1))],
  )
}
const xml = (value) =>
  String(value).replace(
    /[<>&"']/g,
    (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[c],
  )
export function buildGpx(points, name) {
  return `<?xml version="1.0" encoding="UTF-8"?><gpx version="1.1" creator="PACEHUB" xmlns="http://www.topografix.com/GPX/1/1"><trk><name>${xml(name)}</name><trkseg>${points.map((p, i) => `${i && p.segmentStart ? '</trkseg><trkseg>' : ''}<trkpt lat="${p.lat}" lon="${p.lng}">${p.ele == null ? '' : `<ele>${p.ele}</ele>`}<time>${xml(p.time)}</time></trkpt>`).join('')}</trkseg></trk></gpx>`
}
export function parseHeartRate(value) {
  if (value.byteLength < 2) return null
  const wide = value.getUint8(0) & 1
  if (wide && value.byteLength < 3) return null
  return wide ? value.getUint16(1, true) : value.getUint8(1)
}
export function defaultName(s) {
  const hour = new Date(s.started).getHours()
  return `${hour < 6 ? '새벽' : hour < 12 ? '아침' : hour < 18 ? '오후' : '저녁'} ${s.sport === '바이크' ? '라이딩' : s.sport}`
}
