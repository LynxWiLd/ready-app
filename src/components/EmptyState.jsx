import { BookOpen, LibraryBig, UploadCloud } from 'lucide-react';

export function EmptyState({ onBrowse }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-ink-200 bg-white/60 px-6 py-16 text-center">
      <div className="rounded-2xl bg-gradient-to-br from-indigo-50 to-cyan-50 p-5 text-indigo-400">
        <LibraryBig className="h-12 w-12" />
      </div>
      <div>
        <h2 className="text-lg font-semibold text-ink-800">Tu biblioteca está vacía</h2>
        <p className="mt-1 max-w-sm text-sm text-ink-500">
          Importa archivos EPUB, PDF, TXT o Markdown para empezar. Todo permanece en tu dispositivo.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <button className="btn-primary" onClick={onBrowse}>
          <UploadCloud className="h-4 w-4" /> Importar archivos
        </button>
        <span className="text-xs text-ink-400">o arrastra archivos a cualquier parte de esta ventana</span>
      </div>
    </div>
  );
}

export function SectionHeader({ icon: Icon = BookOpen, title, subtitle, right }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-ink-100 p-2 text-ink-500">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-ink-800">{title}</h1>
          {subtitle && <p className="text-sm text-ink-500">{subtitle}</p>}
        </div>
      </div>
      {right}
    </div>
  );
}
