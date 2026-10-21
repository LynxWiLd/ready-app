import { useEffect, useState } from 'react';

/** Estado persistido en localStorage (espejo ligero del lector). */
export function useLocalStorage(key, initialValue) {
  const [value, setValue] = useState(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw !== null ? JSON.parse(raw) : initialValue;
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* almacenamiento lleno o no disponible */
    }
  }, [key, value]);

  return [value, setValue];
}
