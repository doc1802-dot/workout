import L from 'leaflet'

// OpenStreetMap 기본 타일 (API 키 필요 없음). 어두운 화면에 맞게 index.css의 .dark-tiles 필터로 반전한다.
// CARTO 무료 타일은 이제 API 키를 요구해서 바꿨다.
export function addBaseTiles(map) {
  return L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
    className: 'dark-tiles',
  }).addTo(map)
}
