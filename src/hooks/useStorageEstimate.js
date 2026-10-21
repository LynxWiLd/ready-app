import { useEffect, useState } from 'react';
import { getStorageEstimate } from '../services/storage.js';
import { formatBytes } from '../utils/format.js';

/** Monitorea la cuota de IndexedDB (R-01). */
export function useStorageEstimate() {
  const [estimate, setEstimate] = useState(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const data = await getStorageEstimate();
      if (alive) setEstimate(data);
    };
    load();
    return () => {
      alive = false;
    };
  }, []);

  return {
    ...estimate,
    formattedUsage: estimate ? formatBytes(estimate.usage) : '—',
    formattedQuota: estimate ? formatBytes(estimate.quota) : '—'
  };
}
