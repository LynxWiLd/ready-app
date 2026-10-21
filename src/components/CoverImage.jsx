import { useEffect, useState } from 'react';

/** Muestra un cover almacenado como ArrayBuffer (Dexie) creando un objectURL. */
export function CoverImage({ data, type = 'image/jpeg', alt = '', className }) {
  const [url, setUrl] = useState(null);

  useEffect(() => {
    let objectUrl = null;
    if (data) {
      try {
        const blob = new Blob([data], { type });
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      } catch {
        setUrl(null);
      }
    }
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [data, type]);

  if (!url) {
    return (
      <div className={`flex items-center justify-center bg-gradient-to-br from-ink-100 to-ink-200 ${className || ''}`} aria-hidden>
        <svg viewBox="0 0 24 24" className="h-8 w-8 text-ink-400" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H19a1 1 0 0 1 1 1v13" strokeLinecap="round" />
          <path d="M4 5.5A2.5 2.5 0 0 0 1.5 8v11A1.5 1.5 0 0 0 3 20.5h15a1.5 1.5 0 0 0 1.5-1.5V19" strokeLinecap="round" />
        </svg>
      </div>
    );
  }

  return <img src={url} alt={alt} className={`object-cover ${className || ''}`} loading="lazy" />;
}
