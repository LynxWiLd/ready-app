import { useCallback, useState } from 'react';
import { useLocalStorage } from './useLocalStorage.js';

export const DEFAULT_READER_SETTINGS = {
  theme: 'light', // light | dark | sepia
  font: 'sans', // sans | serif | mono
  fontSize: 18, // px
  lineHeight: 1.6,
  maxWidth: 720, // px
  margin: 16, // px laterales
  pdfZoom: 1.15,
  pdfView: 'scroll', // scroll | single | double
  autoHideUI: true
};

const KEY = 'ready.reader.settings';

export function useReaderSettings() {
  const [settings, setSettings] = useLocalStorage(KEY, DEFAULT_READER_SETTINGS);

  const update = useCallback(
    (patch) => {
      setSettings((prev) => ({ ...prev, ...patch }));
    },
    [setSettings]
  );

  const reset = useCallback(() => setSettings(DEFAULT_READER_SETTINGS), [setSettings]);

  return { settings, update, reset, defaults: DEFAULT_READER_SETTINGS };
}
