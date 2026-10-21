import { BookOpen, Database, Download, Upload, RefreshCw } from 'lucide-react';
import { formatBytes } from '../utils/format.js';

export function StorageIndicator({ estimate }) {
  const pct = estimate?.supported ? estimate.percent : 0;
  const danger = pct > 85;

  return (
    <div
      className="flex items-center gap-2 text-xs text-ink-500"
      title="Espacio usado en este navegador (IndexedDB)"
    >
      <Database className="h-3.5 w-3.5" />
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-ink-200">
        <div
          className={`h-full rounded-full transition-[width] ${danger ? 'bg-rose-500' : 'bg-indigo-500'}`}
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
      <span className="tabular-nums">
        {estimate?.supported ? `${formatBytes(estimate.usage)} de ${formatBytes(estimate.quota)}` : 'Almacenamiento local'}
      </span>
    </div>
  );
}

export function LibraryActions({ onExport, onImport, importing, onRefresh, busy }) {
  return (
    <div className="flex items-center gap-2">
      <button className="btn-outline" onClick={onRefresh} disabled={busy} title="Recargar biblioteca">
        <RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} />
        <span className="hidden sm:inline">Recargar</span>
      </button>
      <button className="btn-outline" onClick={onImport} disabled={importing} title="Restaurar backup (.zip)">
        <Upload className="h-4 w-4" />
        <span className="hidden sm:inline">Restaurar</span>
      </button>
      <button className="btn-outline" onClick={onExport} disabled={importing} title="Exportar backup (.zip)">
        <Download className="h-4 w-4" />
        <span className="hidden sm:inline">Respaldar</span>
      </button>
    </div>
  );
}

export function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-cyan-500 text-white shadow-sm">
        <BookOpen className="h-4.5 w-4.5" />
      </div>
      <div className="leading-tight">
        <p className="text-sm font-semibold text-ink-800">Ready</p>
        <p className="text-[11px] text-ink-400">Lector local-first</p>
      </div>
    </div>
  );
}
