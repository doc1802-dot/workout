import { useEffect, useRef } from 'react'

// 화면 가운데 뜨는 확인 팝업. <dialog>의 showModal이 배경 막기·Esc 닫기·포커스 가두기를 해 준다.
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
      className="confirm"
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
      <div className="actions">
        <button className="danger" disabled={busy} onClick={onConfirm}>
          {busy ? '처리 중…' : confirmLabel}
        </button>
        <button className="secondary" disabled={busy} onClick={onCancel} autoFocus>
          취소
        </button>
      </div>
    </dialog>
  )
}
