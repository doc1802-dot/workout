import { useEffect, useRef, useState } from 'react'
import { acceptPosition, parseHeartRate, persistSession, readSession, tick } from './recorder'

export default function useRecorder(owner) {
  const [recovery, setRecovery] = useState(null)
  // 로그인한 사용자를 알게 되면 그 사람의 기록만 복구 후보로 읽는다
  useEffect(() => {
    setRecovery(owner ? readSession(owner) : null)
  }, [owner])
  const [session, setView] = useState(null)
  const current = useRef(null)
  const [gps, setGps] = useState('GPS 대기')
  const [error, setError] = useState('')
  const [heart, setHeart] = useState(null)
  const [sensor, setSensor] = useState('연결 안 됨')
  const heartRef = useRef(null)
  const bluetooth = useRef(null)
  const setSession = (value) => {
    current.current = typeof value === 'function' ? value(current.current) : value
    setView(current.current)
  }
  const active = !!session && session.status !== 'finished'
  useEffect(() => {
    if (!active) return
    const timer = setInterval(() => setSession((s) => tick(s, Date.now())), 1000)
    const save = () => {
      try {
        if (current.current) persistSession(current.current)
      } catch {
        setError(
          '기기 저장 공간이 부족하거나 차단되어 복구용 저장에 실패했습니다. GPX를 내보내세요.',
        )
      }
    }
    const storageTimer = setInterval(save, 4000)
    const leave = (event) => {
      save()
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', leave)
    document.addEventListener('visibilitychange', save)
    return () => {
      clearInterval(timer)
      clearInterval(storageTimer)
      window.removeEventListener('beforeunload', leave)
      document.removeEventListener('visibilitychange', save)
      save()
    }
  }, [active])
  useEffect(() => {
    if (!active) return
    if (!navigator.geolocation) {
      setGps('GPS 미지원')
      return
    }
    setGps('GPS 탐색 중')
    const id = navigator.geolocation.watchPosition(
      (position) => {
        setGps(
          `GPS ±${Math.round(position.coords.accuracy)} m${position.coords.accuracy > 35 ? ' · 제외' : ''}`,
        )
        const h = heartRef.current
        setSession((s) =>
          acceptPosition(s, position, h && Date.now() - h.time < 10000 ? h.value : null),
        )
      },
      (e) => {
        setGps(
          e.code === 1 ? 'GPS 권한 거부' : e.code === 3 ? 'GPS 탐색 시간 초과' : 'GPS 신호 없음',
        )
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 },
    )
    return () => navigator.geolocation.clearWatch(id)
  }, [active])
  useEffect(() => {
    if (!active || !navigator.wakeLock) return
    let lock
    let disposed = false
    const acquire = async () => {
      if (document.visibilityState !== 'visible' || (lock && !lock.released)) return
      try {
        const next = await navigator.wakeLock.request('screen')
        if (disposed) await next.release()
        else lock = next
      } catch {
        /* The OS may decline when battery is low. */
      }
    }
    acquire()
    document.addEventListener('visibilitychange', acquire)
    return () => {
      disposed = true
      lock?.release().catch(() => {})
      document.removeEventListener('visibilitychange', acquire)
    }
  }, [active])
  useEffect(
    () => () => {
      bluetooth.current?.cleanup()
    },
    [],
  )
  async function connectHeart() {
    setSensor('연결 중…')
    try {
      bluetooth.current?.cleanup()
      const device = await navigator.bluetooth.requestDevice({
        filters: [{ services: ['heart_rate'] }],
      })
      const disconnected = () => {
        setSensor('연결 끊김')
        setHeart(null)
        heartRef.current = null
      }
      device.addEventListener('gattserverdisconnected', disconnected)
      bluetooth.current = {
        cleanup: () => {
          device.removeEventListener('gattserverdisconnected', disconnected)
          device.gatt?.disconnect()
        },
      }
      const server = await device.gatt.connect()
      const service = await server.getPrimaryService('heart_rate')
      const characteristic = await service.getCharacteristic('heart_rate_measurement')
      const changed = (event) => {
        const value = parseHeartRate(event.target.value)
        if (value == null || value <= 0) return
        const sample = { value, time: Date.now() }
        heartRef.current = sample
        setHeart(sample)
        if (current.current?.status === 'recording') {
          setSession((s) => ({ ...s, hrSamples: [...s.hrSamples, sample] }))
        }
      }
      characteristic.addEventListener('characteristicvaluechanged', changed)
      const cleanup = bluetooth.current.cleanup
      bluetooth.current.cleanup = () => {
        characteristic.removeEventListener('characteristicvaluechanged', changed)
        cleanup()
      }
      await characteristic.startNotifications()
      setSensor(device.name || '심박계 연결됨')
    } catch (e) {
      bluetooth.current?.cleanup()
      setSensor(`연결 실패: ${e.message}`)
      setHeart(null)
      heartRef.current = null
    }
  }
  return {
    session,
    setSession,
    recovery,
    setRecovery,
    gps,
    error,
    setError,
    heart,
    sensor,
    connectHeart,
  }
}
