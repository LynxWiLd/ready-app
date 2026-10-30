import { useCallback, useEffect, useState } from 'react';
import {
  Bell,
  BellOff,
  CheckCircle2,
  FolderOpen,
  HardDrive,
  Smartphone,
  ShieldCheck
} from 'lucide-react';
import { Modal } from './Modal.jsx';
import {
  needsInstallForNotifications,
  notificationPermission,
  permissionLabel,
  requestNotificationPermission
} from '../services/notifications.js';
import { isStandalone } from '../services/pwa.js';
import { cn } from '../utils/cn.js';

/**
 * Panel de permisos del dispositivo.
 *
 * Ready es una PWA local-first: solo puede pedir lo que el navegador expone.
 * El acceso a archivos no se concede de forma permanente (el sistema abre el
 * selector y comparte únicamente el archivo elegido), así que aquí se explica
 * en vez de simular un permiso que no existe.
 */
export function PermissionsPanel({ open, onClose, intro = false, onPickFiles }) {
  const [permission, setPermission] = useState('default');
  const [persisted, setPersisted] = useState('default');
  const [installed, setInstalled] = useState(false);
  const [busy, setBusy] = useState(null);

  const refresh = useCallback(async () => {
    setPermission(notificationPermission());
    setInstalled(isStandalone());
    setPersisted(await readPersisted());
  }, []);

  useEffect(() => {
    if (!open) return;
    refresh();
  }, [open, refresh]);

  const askNotifications = async () => {
    setBusy('notifications');
    try {
      const result = await requestNotificationPermission();
      setPermission(result);
    } finally {
      setBusy(null);
    }
  };

  const askPersistence = async () => {
    setBusy('storage');
    try {
      setPersisted(await requestPersist());
    } finally {
      setBusy(null);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={intro ? 'Permisos de Ready' : 'Permisos del dispositivo'}
      size="md"
      footer={
        intro ? (
          <>
            <button className="btn-ghost" onClick={onClose}>
              Ahora no
            </button>
            <button className="btn-primary" onClick={onClose}>
              Continuar
            </button>
          </>
        ) : (
          <button className="btn-outline" onClick={onClose}>
            Cerrar
          </button>
        )
      }
    >
      <div className="space-y-4">
        {intro && (
          <p className="text-sm leading-relaxed text-ink-600">
            Ready guarda todo en tu teléfono, sin cuentas ni servidores. Estos permisos mejoran la
            experiencia; puedes omitirlos y cambiarlos más tarde.
          </p>
        )}

        <PermissionCard
          icon={permission === 'denied' ? BellOff : Bell}
          title="Notificaciones"
          description={
            permission === 'denied'
              ? 'Están bloqueadas. Actívalas desde los ajustes del navegador o de la app para recibir recordatorios.'
              : 'Para avisarte de que toca continuar un libro y de las versiones nuevas.'
          }
          status={permissionLabel(permission)}
          tone={permission === 'granted' ? 'ok' : permission === 'denied' ? 'bad' : 'off'}
          action={
            permission === 'default' && (
              <button
                className="btn-outline"
                onClick={askNotifications}
                disabled={busy === 'notifications'}
              >
                Permitir
              </button>
            )
          }
        />

        {needsInstallForNotifications() && permission !== 'granted' && (
          <p className="rounded-lg bg-amber-50 p-3 text-xs leading-relaxed text-amber-800">
            En iPhone o iPad, las notificaciones solo funcionan con Ready instalada en la pantalla
            de inicio (Compartir → «Añadir a pantalla de inicio»).
          </p>
        )}

        <PermissionCard
          icon={HardDrive}
          title="Almacenamiento permanente"
          description="Pide al navegador que no borre tus libros por falta de espacio."
          status={
            persisted === 'granted'
              ? 'Protegido'
              : persisted === 'unsupported'
                ? 'No disponible'
                : 'Mejor esfuerzo'
          }
          tone={persisted === 'granted' ? 'ok' : persisted === 'unsupported' ? 'off' : 'warn'}
          action={
            persisted !== 'granted' && (
              <button
                className="btn-outline"
                onClick={askPersistence}
                disabled={busy === 'storage' || persisted === 'unsupported'}
              >
                Proteger
              </button>
            )
          }
        />

        <PermissionCard
          icon={FolderOpen}
          title="Archivos del dispositivo"
          description="El acceso es por archivo: el sistema abre su selector y solo comparte el que elijas. Ready nunca lee el resto."
          status="Concedido al elegir"
          tone="ok"
          action={
            onPickFiles && (
              <button
                className="btn-outline"
                onClick={() => {
                  onPickFiles();
                  onClose?.();
                }}
              >
                Elegir archivo
              </button>
            )
          }
        />

        <PermissionCard
          icon={installed ? CheckCircle2 : Smartphone}
          title="Instalación"
          description={
            installed
              ? 'Ready se abrió como aplicación instalada: avisos y recordatorios funcionan mejor.'
              : 'Añádela a tu pantalla de inicio para abrirla a pantalla completa y actualizarla sin reinstalar.'
          }
          status={installed ? 'Instalada' : 'Desde el navegador'}
          tone={installed ? 'ok' : 'off'}
        />

        <p className="flex items-start gap-2 rounded-lg bg-ink-50 p-3 text-xs leading-relaxed text-ink-500">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
          Ready no envía datos a ningún servidor. Puedes revisar o retirar estos permisos desde los
          ajustes del navegador.
        </p>
      </div>
    </Modal>
  );
}

function PermissionCard({ icon: Icon, title, description, status, tone, action }) {
  return (
    <div className="rounded-xl border border-ink-200 p-3.5">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink-100 text-ink-600">
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-ink-800">{title}</p>
            <span
              className={cn(
                'chip text-[11px]',
                tone === 'ok' && 'bg-emerald-100 text-emerald-800',
                tone === 'warn' && 'bg-amber-100 text-amber-800',
                tone === 'bad' && 'bg-rose-100 text-rose-800',
                tone === 'off' && 'bg-ink-100 text-ink-600'
              )}
            >
              {status}
            </span>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-ink-500">{description}</p>
        </div>
      </div>
      {action && <div className="mt-3 flex justify-end">{action}</div>}
    </div>
  );
}

async function readPersisted() {
  if (typeof navigator === 'undefined' || !navigator.storage?.persisted) return 'unsupported';
  try {
    return (await navigator.storage.persisted()) ? 'granted' : 'default';
  } catch {
    return 'unsupported';
  }
}

async function requestPersist() {
  if (typeof navigator === 'undefined' || !navigator.storage?.persist) return 'unsupported';
  try {
    return (await navigator.storage.persist()) ? 'granted' : 'default';
  } catch {
    return 'unsupported';
  }
}
