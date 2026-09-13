export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  onConfirm,
  onCancel,
}) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-slate-900/40 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200/80 bg-white p-6 shadow-[0_20px_60px_-10px_rgba(15,23,42,0.4)]">
        <h3 className="text-[17px] font-bold text-navy">{title}</h3>
        <p className="mt-2 text-[14px] leading-relaxed text-slate-500">{message}</p>
        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-[13.5px] font-semibold text-slate-600 transition-colors hover:bg-slate-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`flex-1 rounded-xl px-4 py-2.5 text-[13.5px] font-bold text-white transition-colors ${
              destructive ? 'bg-red hover:bg-red-dark' : 'bg-navy hover:bg-navy-dark'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}