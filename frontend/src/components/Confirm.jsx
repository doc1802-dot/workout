export default function Confirm({ message, busy, onConfirm, onCancel }) {
  return (
    <div className="confirm" role="alertdialog" aria-label={message}>
      <p>{message}</p>
      <div className="actions">
        <button className="danger" disabled={busy} onClick={onConfirm}>
          {busy ? '처리 중…' : '확인'}
        </button>
        <button className="secondary" disabled={busy} onClick={onCancel}>
          취소
        </button>
      </div>
    </div>
  )
}
