import { useEffect, useState } from 'react';
import { CheckCircle2, RefreshCw, X } from 'lucide-react';
import { applyUpdate, APP_VERSION, initPwa, onPwaEvent } from '../services/pwa.js';

/**
 * Aviso de nueva versión. En móvil es la diferencia entre actualizar con un
 * toque y tener que desinstalar la PWA para ver los cambios.
 */
export function UpdateBanner() {
  const [needRefresh, setNeedRefresh] = useState(false);
  const [offlineReady, setOfflineReady] = useState(false);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    initPwa();
    const offUpdate = onPwaEvent('updateReady', () => setNeedRefresh(true));
    const offOffline = onPwaEvent('offlineReady', () => setOfflineReady(true));
    return () => {
      offUpdate();
      offOffline();
    };
  }, []);

  useEffect(() => {
    if (!offlineReady) return undefined;
    const t = setTimeout(() => setOfflineReady(false), 4500);
    return () => clearTimeout(t);
  }, [offlineReady]);

  if (!needRefresh && !offlineReady) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[95] px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-4">
      {needRefresh ? (
        <div
          role="status"
          aria-live="polite"
          className="pointer-events-auto mx-auto flex max-w-xl flex-wrap items-center gap-3 rounded-2xl border border-indigo-200 bg-white/95 p-3.5 shadow-xl backdrop-blur animate-slide-up"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
            <RefreshCw className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-ink-800">Hay una versión nueva de Ready</p>
            <p className="text-xs leading-snug text-ink-500">
              Actualiza para tener las últimas mejoras. Tus libros, notas y resaltados se conservan.
            </p>
          </div>
          <div className="flex w-full items-center justify-end gap-2 sm:w-auto">
            <button
              className="btn-ghost"
              onClick={() => setNeedRefresh(false)}
              aria-label="Recordar más tarde"
            >
              <X className="h-4 w-4" /> Ahora no
            </button>
            <button
              className="btn-primary"
              disabled={applying}
              onClick={async () => {
                setApplying(true);
                await applyUpdate();
              }}
            >
              <RefreshCw className={`h-4 w-4 ${applying ? 'animate-spin' : ''}`} />
              Actualizar
            </button>
          </div>
          <p className="w-full text-[11px] text-ink-400">Ready {APP_VERSION}</p>
        </div>
      ) : (
        <div className="pointer-events-auto mx-auto flex max-w-xl items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50/95 px-4 py-2.5 text-sm text-emerald-800 shadow-lg backdrop-blur animate-slide-up">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          Listo: la app ya funciona sin conexión.
          <button
            className="icon-btn ml-auto h-7 w-7"
            onClick={() => setOfflineReady(false)}
            aria-label="Cerrar aviso"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
