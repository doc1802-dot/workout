import { useEffect, useMemo, useRef } from 'react'
import L from 'leaflet'
import codec from '@mapbox/polyline'
import { addBaseTiles } from '../lib/mapTiles'
// RouteMap accepts encoded polyline or latlng pairs, height (default 240), interactive (false).
export default function RouteMap({ polyline, latlng, height = 240, interactive = false }) {
  const container = useRef(null)
  const points = useMemo(() => {
    try {
      const decoded = latlng || (polyline ? codec.decode(polyline) : [])
      return decoded.filter(
        (point) =>
          Array.isArray(point) &&
          point.length >= 2 &&
          Number.isFinite(point[0]) &&
          Number.isFinite(point[1]) &&
          Math.abs(point[0]) <= 90 &&
          Math.abs(point[1]) <= 180,
      )
    } catch {
      return []
    }
  }, [polyline, latlng])
  useEffect(() => {
    if (!points.length || !container.current) return
    const map = L.map(container.current, {
      dragging: interactive,
      scrollWheelZoom: interactive,
      doubleClickZoom: interactive,
      touchZoom: interactive,
      boxZoom: interactive,
      keyboard: interactive,
      zoomControl: interactive,
    })
    addBaseTiles(map)
    const route = L.polyline(points, { color: '#ff571b', weight: 4 }).addTo(map)
    for (const [index, point] of [points[0], points.at(-1)].entries()) {
      L.circleMarker(point, {
        radius: 5,
        color: '#fff',
        weight: 2,
        fillColor: index ? '#ff571b' : '#4edea3',
        fillOpacity: 1,
      }).addTo(map)
    }
    const fit = () => {
      map.invalidateSize()
      map.fitBounds(route.getBounds(), { padding: [24, 24], maxZoom: 15 })
    }
    fit()
    const observer = new ResizeObserver(fit)
    observer.observe(container.current)
    return () => {
      observer.disconnect()
      map.remove()
    }
  }, [points, interactive])
  return points.length ? (
    <div
      ref={container}
      style={{ height }}
      className="relative z-0 w-full"
      role="region"
      aria-label="활동 경로 지도"
    />
  ) : (
    <div
      style={{ height }}
      className="flex items-center justify-center bg-surface-container-lowest text-on-surface-variant"
    >
      경로 데이터 없음
    </div>
  )
}
