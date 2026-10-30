import { registerSW } from 'virtual:pwa-register';

/**
 * Registro del service worker con aviso de nueva versión.
 *
 * En una PWA instalada (sobre todo en Android/iOS) la app puede quedarse en
 * segundo plano durante días: sin comprobaciones explícitas el service worker
 * nunca ve la versión nueva y el usuario acaba desinstalando para actualizar.
 * Por eso, además de registrar, forzamos `registration.update()` al volver a
 * primer plano y cada pocos minutos mientras la app está abierta.
 */

const CHECK_INTERVAL_MS = 15 * 60 * 1000;
const MIN_FOREGROUND_GAP_MS = 60 * 1000;

const listeners = {
  updateReady: new Set(),
  offlineReady: new Set(),
  registered: new Set()
};

let registration = null;
let updateServiceWorker = null;
let started = false;
let lastCheck = 0;
let intervalId = null;

function emit(event, payload) {
  for (const fn of listeners[event]) {
    try {
      fn(payload);
    } catch {
      /* un listener roto no debe afectar al resto */
    }
  }
}

export function onPwaEvent(event, handler) {
  listeners[event]?.add(handler);
  return () => listeners[event]?.delete(handler);
}

/** Registra el service worker. Idempotente. */
export function initPwa() {
  if (started || typeof window === 'undefined') return;
  started = true;

  updateServiceWorker = registerSW({
    immediate: true,
    onNeedRefresh: () => emit('updateReady'),
    onOfflineReady: () => emit('offlineReady'),
    onRegisteredSW: (_swUrl, reg) => {
      if (!reg) return;
      registration = reg;
      emit('registered', reg);
      startUpdateChecks(reg);
    },
    onRegisterError: (err) => {
      console.warn('[Ready] No se pudo registrar el service worker', err);
    }
  });
}

function startUpdateChecks(reg) {
  const check = () => {
    lastCheck = Date.now();
    reg.update().catch(() => {
      /* sin red o SW no disponible */
    });
  };

  check();

  if (intervalId) clearInterval(intervalId);
  intervalId = setInterval(check, CHECK_INTERVAL_MS);

  const onVisible = () => {
    if (document.visibilityState !== 'visible') return;
    if (Date.now() - lastCheck < MIN_FOREGROUND_GAP_MS) return;
    check();
  };

  document.addEventListener('visibilitychange', onVisible);
  window.addEventListener('pageshow', onVisible);
  window.addEventListener('online', onVisible);
}

/**
 * Aplica la actualización pendiente y recarga.
 *
 * No dependemos solo del reload de Workbox: en algunos casos el evento
 * `controlling` llega con `isUpdate` en falso y la PWA se quedaba con el
 * código viejo hasta reinstalarla. Escuchamos el cambio de controlador y, si
 * no llega, recargamos igualmente.
 */
export async function applyUpdate() {
  if (!updateServiceWorker) {
    window.location.reload();
    return;
  }

  let reloading = false;
  const reload = () => {
    if (reloading) return;
    reloading = true;
    window.location.reload();
  };

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('controllerchange', reload, { once: true });
  }

  await updateServiceWorker(true);

  // Red de seguridad: el SW ya se activó o lo hará en breve.
  setTimeout(reload, 2500);
}

/**
 * Comprueba si hay una versión nueva.
 * @returns {Promise<'available'|'current'|'unsupported'|'error'>}
 */
export async function checkForUpdate() {
  if (!('serviceWorker' in navigator)) return 'unsupported';

  let reg = registration;
  if (!reg) {
    try {
      reg = await navigator.serviceWorker.getRegistration();
    } catch {
      return 'error';
    }
  }
  if (!reg) return 'unsupported';

  try {
    await reg.update();
  } catch {
    return 'error';
  }
  lastCheck = Date.now();
  return reg.waiting || reg.installing ? 'available' : 'current';
}

/** Indica si la app se abrió como PWA instalada. */
export function isStandalone() {
  return (
    (typeof window !== 'undefined' && window.matchMedia?.('(display-mode: standalone)')?.matches) ||
    window.navigator.standalone === true
  );
}

export const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0';
export const BUILD_STAMP = typeof __BUILD_STAMP__ !== 'undefined' ? __BUILD_STAMP__ : '';
