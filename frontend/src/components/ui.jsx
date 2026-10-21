// Icon accepts name, className and decorative children as a fallback name.
export function Icon({ name, children, className = '' }) {
  return (
    <span aria-hidden="true" className={`material-symbols-outlined ${className}`}>
      {name || children}
    </span>
  )
}
// Panel accepts title, subtitle, actions, children and className.
export function Panel({ title, subtitle, actions, children, className = '' }) {
  return (
    <section className={`rounded-xl bg-surface-container p-5 ${className}`}>
      {(title || subtitle || actions) && (
        <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            {title && <h2 className="font-headline-sm text-headline-sm text-white">{title}</h2>}
            {subtitle && (
              <p className="mt-1 font-label-caps text-label-caps text-on-surface-variant">
                {subtitle}
              </p>
            )}
          </div>
          {actions}
        </header>
      )}
      {children}
    </section>
  )
}
// Metric accepts label, value, unit, sub and className.
export function Metric({ label, value, unit, sub, className = '' }) {
  return (
    <div className={`min-w-0 ${className}`}>
      <p className="font-label-caps text-label-caps text-on-surface-variant">{label}</p>
      <p className="mt-2 break-words font-metric-lg text-metric-lg text-white">
        {value}
        <span className="ml-1 text-body-sm text-on-surface-variant">{unit}</span>
      </p>
      {sub && <p className="mt-1 text-body-sm text-on-surface-variant">{sub}</p>}
    </div>
  )
}
// Badge accepts children and className.
export function Badge({ children, className = '' }) {
  return (
    <span
      className={`inline-flex items-center rounded bg-surface-container-high px-2 py-1 font-label-caps text-label-caps text-primary ${className}`}
    >
      {children}
    </span>
  )
}
// EmptyState accepts title, description and actions.
export function EmptyState({ title = '기록이 없습니다', description, actions }) {
  return (
    <div className="rounded-xl bg-surface-container p-8 text-center">
      <Icon name="exercise" className="mb-3 text-primary-container" />
      <h2 className="text-headline-sm">{title}</h2>
      {description && <p className="my-3 text-on-surface-variant">{description}</p>}
      {actions}
    </div>
  )
}
// ErrorNotice accepts message, children and optional onRetry.
export function ErrorNotice({ message, children, onRetry }) {
  return (
    <div role="alert" className="rounded-lg bg-error-container/30 p-4 text-error">
      <p>{message || children}</p>
      {onRetry && (
        <button className="secondary mt-3" onClick={onRetry}>
          다시 불러오기
        </button>
      )}
    </div>
  )
}
// Loading accepts an optional label.
export function Loading({ label = '불러오는 중…' }) {
  return (
    <p role="status" className="p-6 text-on-surface-variant">
      {label}
    </p>
  )
}
