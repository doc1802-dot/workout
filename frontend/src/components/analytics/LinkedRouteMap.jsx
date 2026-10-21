import { useEffect, useMemo, useState } from 'react'
import L from 'leaflet'
import codec from '@mapbox/polyline'
import { addBaseTiles } from '../../lib/mapTiles'

const valid = (point) =>
  Array.isArray(point) &&
  Number.isFinite(point[0]) &&
  Number.isFinite(point[1]) &&
  Math.abs(point[0]) <= 90 &&
  Math.abs(point[1]) <= 180

// Own Leaflet instance; never reaches into the shared RouteMap's DOM or private refs.
export default function LinkedRouteMap({ polyline, latlng, hoveredIndex }) {
  const [node, setNode] = useState(null)
  const [map, setMap] = useState(null)
  const points = useMemo(() => {
    try {
      return (polyline ? codec.decode(polyline) : latlng || []).filter(valid)
    } catch {
      return (latlng || []).filter(valid)
    }
  }, [polyline, latlng])
  useEffect(() => {
    if (!node || !points.length) return
    const instance = L.map(node)
    addBaseTiles(instance)
    const route = L.polyline(points, { color: '#ff571b', weight: 4 }).addTo(instance)
    const fit = () => {
      instance.invalidateSize()
      instance.fitBounds(route.getBounds(), { padding: [24, 24], maxZoom: 15 })
    }
    fit()
    setMap(instance)
    const observer = new ResizeObserver(fit)
    observer.observe(node)
    return () => {
      observer.disconnect()
      instance.remove()
      setMap(null)
    }
  }, [node, points])
  useEffect(() => {
    const point = hoveredIndex == null ? null : latlng?.[hoveredIndex]
    if (!map || !valid(point)) return
    const marker = L.circleMarker(point, {
      radius: 8,
      color: '#fff',
      weight: 2,
      fillColor: '#c3f400',
      fillOpacity: 1,
    }).addTo(map)
    return () => marker.remove()
  }, [map, latlng, hoveredIndex])
  return points.length ? (
    <div
      ref={setNode}
      className="relative z-0 h-80 w-full"
      role="region"
      aria-label="고도 차트 선택 지점과 활동 경로 지도"
    />
  ) : (
    <p className="p-5 text-on-surface-variant">경로 데이터가 없습니다.</p>
  )
}
