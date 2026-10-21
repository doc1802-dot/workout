import { useEffect, useRef } from 'react'

// Confirm accepts message, busy, onConfirm, onCancel and confirmLabel; uses a modal dialog.
export default function Confirm({ message, busy, onConfirm, onCancel, confirmLabel = '확인' }) {
  const dialog = useRef(null)
  useEffect(() => {
    const node = dialog.current
    node.showModal()
    return () => node.close()
  }, [])
  return (
    <dialog
      ref={dialog}
      className="max-w-md"
      aria-label={message}
      onCancel={(event) => {
        event.preventDefault()
        if (!busy) onCancel()
      }}
      onClick={(event) => {
        if (event.target === dialog.current && !busy) onCancel()
      }}
    >
      <p>{message}</p>
      <div className="mt-6 flex flex-wrap justify-end gap-3">
        <button
          className="rounded-lg bg-error-container px-4 py-2 text-on-error-container"
          disabled={busy}
          onClick={onConfirm}
        >
          {busy ? '처리 중…' : confirmLabel}
        </button>
        <button className="secondary" disabled={busy} onClick={onCancel} autoFocus>
          취소
        </button>
      </div>
    </dialog>
  )
}
