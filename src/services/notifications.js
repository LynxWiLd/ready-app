/**
 * Notificaciones locales. Ready no tiene servidor: todo se muestra desde el
 * propio dispositivo con la API del navegador.
 */

export const ICON_PATH = 'favicon.svg';

export function notificationsSupported() {
  return typeof window !== 'undefined' && 'Notification' in window;
}

/** 'granted' | 'denied' | 'default' | 'unsupported' */
export function notificationPermission() {
  if (!notificationsSupported()) return 'unsupported';
  return Notification.permission;
}

export async function requestNotificationPermission() {
  if (!notificationsSupported()) return 'unsupported';
  if (Notification.permission !== 'default') return Notification.permission;
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

/**
 * Muestra una notificación. Usa el service worker cuando existe para que el
 * clic abra la app en el libro correcto (iOS exige este camino).
 */
export async function showNotification(title, options = {}) {
  if (notificationPermission() !== 'granted') return false;

  const payload = {
    icon: ICON_PATH,
    badge: ICON_PATH,
    lang: 'es',
    ...options
  };

  try {
    const reg =
      'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : null;
    if (reg) {
      await reg.showNotification(title, payload);
      return true;
    }
    new Notification(title, payload);
    return true;
  } catch {
    return false;
  }
}

export function permissionLabel(state) {
  switch (state) {
    case 'granted':
      return 'Permitido';
    case 'denied':
      return 'Bloqueado';
    case 'unsupported':
      return 'No disponible';
    default:
      return 'Sin decidir';
  }
}

/** En iPhone/iPad solo las PWA instaladas pueden mostrar notificaciones. */
export function needsInstallForNotifications() {
  if (typeof navigator === 'undefined') return false;
  const isIos =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone =
    window.matchMedia?.('(display-mode: standalone)')?.matches ||
    navigator.standalone === true;
  return isIos && !standalone;
}
