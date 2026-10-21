import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import { cn } from '../utils/cn.js';

const ICONS = {
  success: CheckCircle2,
  error: AlertTriangle,
  info: Info
};

export function ToastContainer({ toasts, onDismiss }) {
  return (
    <div className="pointer-events-none fixed bottom-4 left-1/2 z-[100] flex w-full max-w-sm -translate-x-1/2 flex-col gap-2 px-4 sm:left-auto sm:right-4 sm:translate-x-0 sm:px-0">
      {toasts.map((t) => {
        const Icon = ICONS[t.type] || Info;
        return (
          <div
            key={t.id}
            className={cn(
              'pointer-events-auto flex items-start gap-3 rounded-xl border px-4 py-3 shadow-lg backdrop-blur animate-slide-up',
              t.type === 'error' && 'border-rose-200 bg-rose-50 text-rose-800',
              t.type === 'success' && 'border-emerald-200 bg-emerald-50 text-emerald-800',
              t.type === 'info' && 'border-ink-200 bg-white text-ink-700'
            )}
          >
            <Icon className="mt-0.5 h-4 w-4 shrink-0" />
            <p className="flex-1 text-sm leading-snug">{t.message}</p>
            <button className="icon-btn -mr-1 -mt-1 h-7 w-7" onClick={() => onDismiss(t.id)} aria-label="Cerrar aviso">
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
