import { Icon } from './ui'
const icons = {
  러닝: ['directions_run', 'text-primary-container'],
  바이크: ['directions_bike', 'text-secondary-container'],
  하이킹: ['hiking', 'text-tertiary'],
  걷기: ['directions_walk', 'text-primary'],
  수영: ['pool', 'text-tertiary'],
  기타: ['fitness_center', 'text-on-surface-variant'],
}
// SportIcon accepts sport and className; pair this decorative icon with a text label.
export default function SportIcon({ sport, className = '' }) {
  const [name, color] = icons[sport] || icons.기타
  return <Icon name={name} className={`${color} ${className}`} />
}
