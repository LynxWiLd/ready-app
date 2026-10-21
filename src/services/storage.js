/** Utilidades de almacenamiento: estimación de cuota (R-01). */

export async function getStorageEstimate() {
  if (!navigator.storage?.estimate) {
    return { supported: false, usage: 0, quota: 0, percent: 0 };
  }
  const { usage = 0, quota = 0 } = await navigator.storage.estimate();
  return {
    supported: true,
    usage,
    quota,
    percent: quota ? Math.min(100, (usage / quota) * 100) : 0
  };
}

export async function canPersist() {
  if (!navigator.storage?.persisted) return { supported: false, persisted: false };
  const persisted = await navigator.storage.persisted();
  return { supported: true, persisted };
}

export async function requestPersist() {
  if (!navigator.storage?.persist) return false;
  try {
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

/** Descarta un objectURL si es seguro. */
export function safeRevoke(url) {
  if (url && url.startsWith('blob:')) {
    try {
      URL.revokeObjectURL(url);
    } catch {
      /* noop */
    }
  }
}
