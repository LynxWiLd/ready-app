import { useCallback, useState } from 'react';
import { uuid } from '../utils/id.js';

let seq = 0;

/** Sistema de notificaciones (toasts) accesible globalmente. */
export function useToasts() {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (message, type = 'info', duration = 3500) => {
      const id = `t-${Date.now()}-${seq++}`;
      setToasts((prev) => [...prev, { id, message, type }]);
      if (duration) setTimeout(() => dismiss(id), duration);
      return id;
    },
    [dismiss]
  );

  return {
    toasts,
    dismiss,
    toast: push,
    success: (m, d) => push(m, 'success', d),
    error: (m, d) => push(m, 'error', d),
    info: (m, d) => push(m, 'info', d)
  };
}

export function makeId() {
  return uuid();
}
