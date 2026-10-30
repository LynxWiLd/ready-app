import { useState } from 'react';
import { BookOpen, Moon, RefreshCw, RotateCcw, ShieldCheck, Sun } from 'lucide-react';
import { Modal } from './Modal.jsx';
import { RemindersSection } from './RemindersSection.jsx';
import { APP_VERSION, BUILD_STAMP, checkForUpdate } from '../services/pwa.js';
import { cn } from '../utils/cn.js';

const THEMES = [
  { id: 'light', label: 'Claro', icon: Sun, swatch: 'bg-white border-ink-300' },
  { id: 'dark', label: 'Oscuro', icon: Moon, swatch: 'bg-ink-800 border-ink-600' },
  { id: 'sepia', label: 'Sepia', icon: BookOpen, swatch: 'bg-sepia-100 border-sepia-400' }
];

const FONTS = [
  { id: 'sans', label: 'Sans-serif', cls: 'font-sans' },
  { id: 'serif', label: 'Serif', cls: 'font-serif' },
  { id: 'mono', label: 'Monospace', cls: 'font-mono' }
];

export function SettingsPanel({
  open,
  onClose,
  settings,
  update,
  reset,
  notify = {},
  onOpenPermissions,
  appSettings = true,
  format = null
}) {
  const [checking, setChecking] = useState(false);
  const set = (patch) => update(patch);

  // Solo mostramos los ajustes que afectan al formato abierto. Sin formato
  // (biblioteca) se muestran todos, porque se aplican a cualquier libro.
  const showTypography = format !== 'pdf';
  const showPdf = !format || format === 'pdf';

  const checkUpdate = async () => {
    setChecking(true);
    try {
      const result = await checkForUpdate();
      if (result === 'available') {
        notify.info?.('Hay una versión nueva: acepta el aviso para actualizar.');
      } else if (result === 'current') {
        notify.success?.('Ya tienes la última versión.');
      } else if (result === 'unsupported') {
        notify.info?.('Las actualizaciones se aplican al abrir la app instalada.');
      } else {
        notify.error?.('No se pudo comprobar la actualización.');
      }
    } finally {
      setChecking(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Ajustes de lectura"
      size="md"
      footer={
        <button className="btn-ghost" onClick={reset}>
          <RotateCcw className="h-4 w-4" /> Restablecer
        </button>
      }
    >
      <div className="space-y-6">
        {showTypography && (
          <>
            <section>
              <span className="label">Tema</span>
              <div className="grid grid-cols-3 gap-2">
                {THEMES.map((t) => {
                  const Icon = t.icon;
                  const active = settings.theme === t.id;
                  return (
                    <button
                      key={t.id}
                      onClick={() => set({ theme: t.id })}
                      className={cn(
                        'flex flex-col items-center gap-1.5 rounded-xl border-2 px-3 py-3 transition',
                        active
                          ? 'border-indigo-500 bg-indigo-50/60'
                          : 'border-ink-200 hover:border-ink-300'
                      )}
                    >
                      <span className={cn('h-8 w-8 rounded-full border', t.swatch)} />
                      <span className="flex items-center gap-1 text-xs font-medium text-ink-700">
                        <Icon className="h-3.5 w-3.5" />
                        {t.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            <section>
              <span className="label">Tipo de fuente</span>
              <div className="grid grid-cols-3 gap-2">
                {FONTS.map((f) => {
                  const active = settings.font === f.id;
                  return (
                    <button
                      key={f.id}
                      onClick={() => set({ font: f.id })}
                      className={cn(
                        'rounded-xl border-2 px-3 py-2.5 text-sm transition',
                        f.cls,
                        active
                          ? 'border-indigo-500 bg-indigo-50/60'
                          : 'border-ink-200 hover:border-ink-300'
                      )}
                    >
                      {f.label}
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="grid grid-cols-2 gap-4">
              <Slider
                label={`Tamaño de fuente · ${settings.fontSize}px`}
                min={12}
                max={32}
                step={1}
                value={settings.fontSize}
                onChange={(v) => set({ fontSize: v })}
              />
              <Slider
                label={`Interlineado · ${settings.lineHeight.toFixed(2)}`}
                min={1.1}
                max={2.2}
                step={0.05}
                value={settings.lineHeight}
                onChange={(v) => set({ lineHeight: v })}
              />
            </section>

            <section className="grid grid-cols-2 gap-4">
              <Slider
                label={`Ancho de línea · ${settings.maxWidth}px`}
                min={420}
                max={1100}
                step={10}
                value={settings.maxWidth}
                onChange={(v) => set({ maxWidth: v })}
              />
              <Slider
                label={`Márgenes · ${settings.margin}px`}
                min={0}
                max={64}
                step={4}
                value={settings.margin}
                onChange={(v) => set({ margin: v })}
              />
            </section>
          </>
        )}

        {showPdf && (
          <section className="border-t border-ink-100 pt-4">
            <span className="label">PDF</span>
            <div className="grid grid-cols-2 gap-4">
              <Slider
                label={`Zoom · ${settings.pdfZoom.toFixed(2)}×`}
                min={0.5}
                max={3}
                step={0.05}
                value={settings.pdfZoom}
                onChange={(v) => set({ pdfZoom: v })}
              />
              <div>
                <span className="label">Modo de vista</span>
                <div className="grid grid-cols-3 gap-1 rounded-lg bg-ink-100 p-1 text-xs">
                  {[
                    { id: 'scroll', label: 'Desplazar' },
                    { id: 'single', label: '1 página' },
                    { id: 'double', label: '2 páginas' }
                  ].map((m) => (
                    <button
                      key={m.id}
                      onClick={() => set({ pdfView: m.id })}
                      className={cn(
                        'rounded-md px-2 py-1.5 font-medium transition',
                        settings.pdfView === m.id
                          ? 'bg-white text-ink-800 shadow-sm'
                          : 'text-ink-500 hover:text-ink-700'
                      )}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}

        <section className="border-t border-ink-100 pt-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <span className="label">Controles del lector</span>
              <p className="text-xs leading-relaxed text-ink-500">
                Oculta la barra y los botones mientras lees. Vuelven al tocar la pantalla o mover el
                ratón.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={settings.autoHideUI}
              aria-label="Ocultar controles al leer"
              onClick={() => set({ autoHideUI: !settings.autoHideUI })}
              className={cn(
                'relative mt-1 h-6 w-11 shrink-0 rounded-full transition',
                settings.autoHideUI ? 'bg-indigo-600' : 'bg-ink-300'
              )}
            >
              <span
                className={cn(
                  'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all',
                  settings.autoHideUI ? 'left-[22px]' : 'left-0.5'
                )}
              />
            </button>
          </div>
        </section>

        {appSettings && (
          <>
            <RemindersSection notify={notify} />

            <section className="border-t border-ink-100 pt-4">
              <span className="label">Aplicación</span>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-ink-700">Ready {APP_VERSION}</p>
                  <p className="text-xs text-ink-400">{buildLabel()}</p>
                </div>
                <button className="btn-outline" onClick={checkUpdate} disabled={checking}>
                  <RefreshCw className={cn('h-4 w-4', checking && 'animate-spin')} />
                  Buscar actualización
                </button>
              </div>
              <button className="btn-ghost mt-2 w-full justify-start" onClick={onOpenPermissions}>
                <ShieldCheck className="h-4 w-4" /> Permisos del dispositivo
              </button>
            </section>
          </>
        )}

        <p className="rounded-lg bg-ink-50 p-3 text-xs leading-relaxed text-ink-500">
          Los ajustes se guardan automáticamente en este navegador y se aplican a todos los libros.
        </p>
      </div>
    </Modal>
  );
}

function Slider({ label, min, max, step, value, onChange }) {
  return (
    <div>
      <span className="label">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-indigo-600"
      />
    </div>
  );
}

function buildLabel() {
  if (!BUILD_STAMP) return 'Compilación local';
  try {
    const date = new Date(BUILD_STAMP);
    return `Compilación del ${date.toLocaleDateString('es', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    })}`;
  } catch {
    return 'Compilación local';
  }
}
