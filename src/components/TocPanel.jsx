import { ListTree } from 'lucide-react';
import { PanelShell } from './BookmarksPanel.jsx';
import { cn } from '../utils/cn.js';

/**
 * Panel de tabla de contenidos (TOC) de EPUB o PDF.
 * props: toc (lista aplanada {label, href|page, depth}), activeIndex, onJump(item), onClose
 */
export function TocPanel({ toc, activeIndex, onJump, onClose }) {
  return (
    <PanelShell title="Tabla de contenidos" icon={ListTree} count={toc.length} onClose={onClose}>
      {toc.length === 0 ? (
        <p className="rounded-lg bg-ink-50 p-4 text-center text-sm text-ink-500">
          Este libro no incluye tabla de contenidos.
        </p>
      ) : (
        <nav className="space-y-0.5">
          {toc.map((item, i) => (
            <button
              key={`${item.href || item.page || 'item'}#${i}`}
              onClick={() => onJump(item)}
              title={item.label}
              style={{ paddingLeft: `${0.75 + item.depth * 0.85}rem` }}
              className={cn(
                'block w-full truncate rounded-md py-1.5 pr-2 text-left text-sm transition-colors',
                i === activeIndex
                  ? 'bg-indigo-50 font-medium text-indigo-700'
                  : 'text-ink-700 hover:bg-ink-50 hover:text-ink-900'
              )}
            >
              {item.label}
            </button>
          ))}
        </nav>
      )}
    </PanelShell>
  );
}
