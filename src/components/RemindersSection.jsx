import { useEffect, useState } from 'react';
import { BellRing, Clock, Send } from 'lucide-react';
import {
  flushReminderSync,
  loadReminderSettings,
  registerPeriodicReminder,
  saveReminderSettings,
  sendTestReminder,
  unregisterPeriodicReminder
} from '../services/reminders.js';
import {
  notificationPermission,
  permissionLabel,
  requestNotificationPermission
} from '../services/notifications.js';
import { cn } from '../utils/cn.js';

/** Ajustes del recordatorio diario de lectura (RF: continuar el progreso). */
export function RemindersSection({ notify = {} }) {
  const [reminders, setReminders] = useState(() => loadReminderSettings());
  const [permission, setPermission] = useState(() => notificationPermission());
  const [working, setWorking] = useState(false);

  useEffect(() => {
    setPermission(notificationPermission());
  }, []);

  const apply = (patch) => setReminders(saveReminderSettings(patch));

  const toggle = async () => {
    if (working) return;

    if (reminders.enabled) {
      apply({ enabled: false });
      await unregisterPeriodicReminder();
      await flushReminderSync();
      notify.info?.('Recordatorios desactivados.');
      return;
    }

    setWorking(true);
    try {
      const result = await requestNotificationPermission();
      setPermission(result);
      if (result !== 'granted') {
        notify.error?.(
          result === 'denied'
            ? 'Las notificaciones están bloqueadas en este navegador.'
            : 'Este dispositivo no admite notificaciones web.'
        );
        return;
      }
      apply({ enabled: true });
      const background = await registerPeriodicReminder();
      await flushReminderSync();
      notify.success?.(
        background
          ? 'Recordatorio diario activado.'
          : 'Recordatorio activado: se mostrará al abrir la app.'
      );
    } finally {
      setWorking(false);
    }
  };

  const changeHour = (value) => {
    const hour = Number(String(value).split(':')[0]);
    apply({ hour });
    flushReminderSync();
  };

  const sendTest = async () => {
    if (permission !== 'granted') {
      const result = await requestNotificationPermission();
      setPermission(result);
      if (result !== 'granted') {
        notify.error?.('Necesitas permitir las notificaciones para probarlas.');
        return;
      }
    }
    const ok = await sendTestReminder();
    if (ok) notify.success?.('Notificación de prueba enviada.');
    else notify.error?.('El sistema no dejó mostrar la notificación.');
  };

  const hourValue = `${String(reminders.hour).padStart(2, '0')}:00`;

  return (
    <section className="border-t border-ink-100 pt-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="label">Recordatorios de lectura</span>
          <p className="text-xs leading-relaxed text-ink-500">
            Aviso diario para continuar el libro que dejaste a medias.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={reminders.enabled}
          aria-label="Activar recordatorios de lectura"
          onClick={toggle}
          disabled={working}
          className={cn(
            'relative mt-1 h-6 w-11 shrink-0 rounded-full transition',
            reminders.enabled ? 'bg-indigo-600' : 'bg-ink-300',
            working && 'opacity-60'
          )}
        >
          <span
            className={cn(
              'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all',
              reminders.enabled ? 'left-[22px]' : 'left-0.5'
            )}
          />
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-ink-500">
        <span className="chip bg-ink-100 text-ink-600">
          Notificaciones: {permissionLabel(permission)}
        </span>
        {permission === 'denied' && (
          <span className="text-rose-600">Actívalas en los ajustes del navegador.</span>
        )}
      </div>

      {reminders.enabled && (
        <div className="mt-3 grid gap-3 rounded-xl bg-ink-50 p-3 sm:grid-cols-[1fr_auto]">
          <label className="flex items-center gap-2 text-sm text-ink-700">
            <Clock className="h-4 w-4 text-ink-400" />
            <span className="whitespace-nowrap">Avisarme a las</span>
            <input
              type="time"
              className="field w-auto py-1.5"
              value={hourValue}
              onChange={(e) => changeHour(e.target.value)}
            />
          </label>
          <button type="button" className="btn-outline" onClick={sendTest}>
            <Send className="h-4 w-4" />
            Probar
          </button>
        </div>
      )}

      <p className="mt-3 flex items-start gap-2 rounded-lg bg-ink-50 p-3 text-[11px] leading-relaxed text-ink-500">
        <BellRing className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Si ya leíste hoy no se envía. En Android, con Ready instalada, el aviso puede llegar con la
        app cerrada; en iPhone llega al abrirla, porque iOS no despierta apps cerradas sin un
        servidor.
      </p>
    </section>
  );
}
