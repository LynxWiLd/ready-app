import { AlertTriangle } from 'lucide-react';
import { Modal } from './Modal.jsx';

export function ConfirmDialog({ open, title, message, confirmLabel = 'Eliminar', onConfirm, onCancel, busy }) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      footer={
        <>
          <button className="btn-ghost" onClick={onCancel} disabled={busy}>
            Cancelar
          </button>
          <button className="btn-danger" onClick={onConfirm} disabled={busy}>
            {confirmLabel}
          </button>
        </>
      }
    >
      <div className="flex items-start gap-3">
        <div className="rounded-full bg-rose-50 p-2 text-rose-600">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <p className="text-sm leading-relaxed text-ink-600">{message}</p>
      </div>
    </Modal>
  );
}
