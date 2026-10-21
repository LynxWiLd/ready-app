import { cn } from '../utils/cn.js';

export function ProgressBar({ value, className, showLabel = false }) {
  const pct = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-200/70">
        <div
          className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-cyan-500 transition-[width] duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      {showLabel && <span className="w-9 text-right text-xs font-medium tabular-nums text-ink-500">{Math.round(pct)}%</span>}
    </div>
  );
}
