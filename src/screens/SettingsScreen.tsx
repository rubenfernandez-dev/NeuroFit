import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useAppTheme } from '../shared/theme/theme';
import Button from '../shared/ui/Button';
import Card from '../shared/ui/Card';
import { resetSeasonProgress, ThemePreference, resetProfile } from '../shared/storage/profile';
import { resetStats } from '../shared/storage/stats';
import { resetDaily } from '../shared/storage/daily';
import {
  getNotificationPrefs,
  updateNotificationPrefs,
  type NotificationPrefs,
} from '../shared/storage/notifications';
import {
  cancelDailyReminder,
  ensureAndroidChannel,
  requestNotifPermissions,
  scheduleDailyReminder,
} from '../shared/notifications/notifications';
import { STORAGE_KEYS } from '../shared/storage/keys';
import { deleteItem } from '../shared/storage/secureStore';
import {
  getFeedbackPrefs,
  updateFeedbackPrefs,
  type FeedbackPrefs,
} from '../shared/storage/feedback';
import { updateGameFeedbackPreferences } from '../shared/feedback/gameFeedback';
import type { FocusAudioMode } from '../shared/feedback/focusAudio';
import { captureException, logWarning } from '../shared/observability';

const options: ThemePreference[] = ['system', 'light', 'dark'];
const focusAudioOptions: Array<{ mode: FocusAudioMode; label: string }> = [
  { mode: 'silencio', label: 'Silencio' },
  { mode: 'suave', label: 'Suave (armónico)' },
  { mode: 'profundo', label: 'Profundo (grave)' },
  { mode: 'lluvia', label: 'Lluvia' },
  { mode: 'naturaleza', label: 'Naturaleza' },
];

type SettingsStatus = {
  kind: 'success' | 'warning' | 'error';
  text: string;
};

export default function SettingsScreen() {
  const { theme, preference, setPreference } = useAppTheme();
  const [prefs, setPrefs] = useState<NotificationPrefs | null>(null);
  const [feedbackPrefs, setFeedbackPrefs] = useState<FeedbackPrefs | null>(null);
  const [permissionsDenied, setPermissionsDenied] = useState(false);
  const [status, setStatus] = useState<SettingsStatus | null>(null);
  const [isUpdatingTheme, setIsUpdatingTheme] = useState(false);
  const [isUpdatingReminder, setIsUpdatingReminder] = useState(false);
  const [isUpdatingFeedback, setIsUpdatingFeedback] = useState(false);

  useEffect(() => {
    const hydrateSettings = async () => {
      try {
        const [notificationPrefs, nextFeedbackPrefs] = await Promise.all([
          getNotificationPrefs(),
          getFeedbackPrefs(),
        ]);
        setPrefs(notificationPrefs);
        setFeedbackPrefs(nextFeedbackPrefs);
        updateGameFeedbackPreferences(nextFeedbackPrefs);
        setPermissionsDenied(false);
      } catch (error) {
        captureException(error, { area: 'settings.hydration' });
        setStatus({ kind: 'error', text: 'No pudimos cargar tus ajustes. Intenta de nuevo.' });
      }
    };

    hydrateSettings();
  }, []);

  const reloadNotificationPrefs = async () => {
    const nextPrefs = await getNotificationPrefs();
    setPrefs(nextPrefs);
    return nextPrefs;
  };

  const reloadFeedbackPrefs = async () => {
    const nextPrefs = await getFeedbackPrefs();
    setFeedbackPrefs(nextPrefs);
    updateGameFeedbackPreferences(nextPrefs);
    return nextPrefs;
  };

  const displayTime = useMemo(() => {
    const hour = String(prefs?.hour ?? 20).padStart(2, '0');
    const minute = String(prefs?.minute ?? 0).padStart(2, '0');
    return `${hour}:${minute}`;
  }, [prefs]);

  const confirmReset = () => {
    Alert.alert('Reiniciar progreso', 'Esto borrará estadísticas y perfil.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Reiniciar',
        style: 'destructive',
        onPress: async () => {
          await Promise.all([resetStats(), resetProfile()]);
        },
      },
    ]);
  };

  const toggleReminder = async (enabled: boolean) => {
    if (isUpdatingReminder) return;
    setIsUpdatingReminder(true);
    setStatus(null);

    const current = prefs ?? (await getNotificationPrefs());
    let scheduledNotificationId: string | undefined;

    try {
      if (!enabled) {
        if (current.notificationId) {
          await cancelDailyReminder(current.notificationId);
        }
        const updated = await updateNotificationPrefs({ enabled: false, notificationId: undefined });
        setPrefs(updated);
        setPermissionsDenied(false);
        setStatus({ kind: 'success', text: 'Recordatorio desactivado.' });
        return;
      }

      let granted = false;
      try {
        granted = await requestNotifPermissions();
      } catch (error) {
        captureException(error, { area: 'settings.toggleReminder', step: 'request_permission' });
        setPermissionsDenied(false);
        setStatus({ kind: 'error', text: 'No pudimos solicitar permisos de notificaciones.' });
        await reloadNotificationPrefs();
        return;
      }

      if (!granted) {
        if (current.notificationId) {
          await cancelDailyReminder(current.notificationId);
        }
        const updated = await updateNotificationPrefs({ enabled: false, notificationId: undefined });
        setPrefs(updated);
        setPermissionsDenied(true);
        setStatus({ kind: 'warning', text: 'Permiso de notificaciones denegado. El recordatorio sigue desactivado.' });
        return;
      }

      await ensureAndroidChannel();
      scheduledNotificationId = await scheduleDailyReminder(current.hour, current.minute);
      const updated = await updateNotificationPrefs({ enabled: true, notificationId: scheduledNotificationId });

      if (current.notificationId && current.notificationId !== scheduledNotificationId) {
        await cancelDailyReminder(current.notificationId);
      }

      setPrefs(updated);
      setPermissionsDenied(false);
      setStatus({ kind: 'success', text: `Recordatorio activado a las ${String(updated.hour).padStart(2, '0')}:${String(updated.minute).padStart(2, '0')}.` });
    } catch (error) {
      captureException(error, { area: 'settings.toggleReminder', enabled });

      if (scheduledNotificationId) {
        try {
          await cancelDailyReminder(scheduledNotificationId);
        } catch (cancelError) {
          captureException(cancelError, { area: 'settings.toggleReminder', step: 'rollback_cancel_new_notification' });
        }
      }

      await reloadNotificationPrefs();
      setStatus({ kind: 'error', text: 'No pudimos actualizar el recordatorio. Revisa permisos e inténtalo de nuevo.' });
    } finally {
      setIsUpdatingReminder(false);
    }
  };

  const updateTime = async (kind: 'hour' | 'minute', delta: number) => {
    if (isUpdatingReminder) return;
    setIsUpdatingReminder(true);
    setStatus(null);

    const current = prefs ?? (await getNotificationPrefs());
    const hour =
      kind === 'hour'
        ? (current.hour + delta + 24) % 24
        : current.hour;
    const minute =
      kind === 'minute'
        ? (current.minute + delta + 60) % 60
        : current.minute;

    let nextId = current.notificationId;
    let newlyScheduledId: string | undefined;

    try {
      if (current.enabled) {
        await ensureAndroidChannel();
        newlyScheduledId = await scheduleDailyReminder(hour, minute);
        nextId = newlyScheduledId;
      }

      const updated = await updateNotificationPrefs({ hour, minute, notificationId: nextId });

      if (current.enabled && current.notificationId && newlyScheduledId && current.notificationId !== newlyScheduledId) {
        await cancelDailyReminder(current.notificationId);
      }

      setPrefs(updated);
      setPermissionsDenied(false);
      setStatus({ kind: 'success', text: `Hora de recordatorio actualizada a ${String(updated.hour).padStart(2, '0')}:${String(updated.minute).padStart(2, '0')}.` });
    } catch (error) {
      captureException(error, { area: 'settings.updateReminderTime', kind, delta });

      if (newlyScheduledId) {
        try {
          await cancelDailyReminder(newlyScheduledId);
        } catch (cancelError) {
          captureException(cancelError, { area: 'settings.updateReminderTime', step: 'rollback_cancel_new_notification' });
        }
      }

      await reloadNotificationPrefs();
      setStatus({ kind: 'error', text: 'No pudimos actualizar la hora del recordatorio.' });
    } finally {
      setIsUpdatingReminder(false);
    }
  };

  const applyThemePreference = async (nextPreference: ThemePreference) => {
    if (isUpdatingTheme || nextPreference === preference) return;
    setIsUpdatingTheme(true);
    setStatus(null);

    try {
      await setPreference(nextPreference);
      setStatus({ kind: 'success', text: 'Tema actualizado.' });
    } catch (error) {
      captureException(error, { area: 'settings.setTheme', nextPreference });
      setStatus({ kind: 'error', text: 'No pudimos guardar el tema. Se restauró el valor anterior.' });
    } finally {
      setIsUpdatingTheme(false);
    }
  };

  const openSystemSettings = async () => {
    try {
      if (typeof Linking.openSettings === 'function') {
        await Linking.openSettings();
        return;
      }
    } catch (error) {
      logWarning('settings.open_settings_failed', { strategy: 'Linking.openSettings' });
      captureException(error, { area: 'settings.openSystemSettings', strategy: 'openSettings' });
    }

    try {
      await Linking.openURL('app-settings:');
    } catch (error) {
      captureException(error, { area: 'settings.openSystemSettings', strategy: 'app-settings-url' });
      Alert.alert('No se pudo abrir ajustes', 'Abre Ajustes del sistema manualmente para activar notificaciones.');
    }
  };

  const confirmDevReset = (title: string, body: string, action: () => Promise<void>) => {
    Alert.alert(title, body, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Confirmar',
        style: 'destructive',
        onPress: () => {
          action();
        },
      },
    ]);
  };

  const resetAllDebug = async () => {
    await Promise.all([
      resetStats(),
      resetProfile(),
      resetDaily(),
      deleteItem(STORAGE_KEYS.feedback),
      deleteItem(STORAGE_KEYS.sudokuState),
      deleteItem(STORAGE_KEYS.memoryState),
      deleteItem(STORAGE_KEYS.mentalMathState),
      deleteItem(STORAGE_KEYS.patternMemoryState),
      deleteItem(STORAGE_KEYS.focusGridState),
      deleteItem(STORAGE_KEYS.numberMatchState),
      deleteItem(STORAGE_KEYS.leaderboard),
    ]);
  };

  const toggleFeedback = async (partial: Partial<FeedbackPrefs>) => {
    if (isUpdatingFeedback) return;
    setIsUpdatingFeedback(true);
    setStatus(null);

    try {
      const next = await updateFeedbackPrefs(partial);
      setFeedbackPrefs(next);
      updateGameFeedbackPreferences(next);
      setStatus({ kind: 'success', text: 'Ajustes de respuesta actualizados.' });
    } catch (error) {
      captureException(error, { area: 'settings.toggleFeedback', partial });
      await reloadFeedbackPrefs();
      setStatus({ kind: 'error', text: 'No pudimos guardar los ajustes de respuesta.' });
    } finally {
      setIsUpdatingFeedback(false);
    }
  };

  const masterFeedbackEnabled = feedbackPrefs?.enabled ?? true;

  return (
    <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.lg }}>
      {status ? (
        <Card variant={status.kind === 'success' ? 'success' : 'warning'}>
          <Text style={[theme.typography.bodySmall, { color: status.kind === 'success' ? theme.colors.green : theme.colors.red }]}>{status.text}</Text>
        </Card>
      ) : null}

      <Card>
        <Text style={[theme.typography.h3, { color: theme.colors.text }]}>🎨 Tema</Text>
        <View style={{ gap: 8, marginTop: 10 }}>
          {options.map((option) => (
            <Button
              key={option}
              title={option === preference ? `✓ ${option}` : option}
              variant={option === preference ? 'primary' : 'secondary'}
              onPress={() => {
                applyThemePreference(option);
              }}
              disabled={isUpdatingTheme}
            />
          ))}
        </View>
      </Card>

      <Card>
        <Text style={[theme.typography.h3, { color: theme.colors.text }]}>⏰ Recordatorio diario</Text>
        <View style={{ marginTop: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={[theme.typography.body, { color: theme.colors.text }]}>Recordatorio diario</Text>
          <Switch
            value={prefs?.enabled ?? false}
            onValueChange={toggleReminder}
            disabled={isUpdatingReminder}
            trackColor={{ false: theme.colors.border, true: theme.colors.primarySoft }}
            thumbColor={prefs?.enabled ? theme.colors.primary : theme.colors.textMuted}
          />
        </View>
        <Text style={[theme.typography.bodySmall, { color: theme.colors.textMuted, marginTop: 8 }]}>Recibirás un aviso diario para completar tu Reto NeuroFit.</Text>
        {permissionsDenied ? (
          <View style={{ marginTop: 6, gap: 8 }}>
            <Text style={[theme.typography.bodySmall, { color: theme.colors.warning }]}>
              Permisos desactivados. Actívalos en Ajustes del sistema.
            </Text>
            <Button title="Abrir ajustes" variant="ghost" onPress={openSystemSettings} />
          </View>
        ) : null}

        <View style={{ marginTop: 14, gap: 8 }}>
          <Text style={[theme.typography.body, { color: theme.colors.text }]}>Hora: {displayTime}</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button title="Hora -" variant="secondary" onPress={() => updateTime('hour', -1)} style={{ flex: 1 }} disabled={isUpdatingReminder} />
            <Button title="Hora +" variant="secondary" onPress={() => updateTime('hour', 1)} style={{ flex: 1 }} disabled={isUpdatingReminder} />
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button title="Min -5" variant="secondary" onPress={() => updateTime('minute', -5)} style={{ flex: 1 }} disabled={isUpdatingReminder} />
            <Button title="Min +5" variant="secondary" onPress={() => updateTime('minute', 5)} style={{ flex: 1 }} disabled={isUpdatingReminder} />
          </View>
        </View>
      </Card>

      <Card>
        <Text style={[theme.typography.h3, { color: theme.colors.text }]}>✨ Respuesta del juego</Text>

        <View style={{ marginTop: 10, gap: 10 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={[theme.typography.body, { color: theme.colors.text }]}>Respuesta global</Text>
            <Switch
              value={masterFeedbackEnabled}
              onValueChange={(value) => {
                toggleFeedback({ enabled: value });
              }}
              disabled={isUpdatingFeedback}
              trackColor={{ false: theme.colors.border, true: theme.colors.primarySoft }}
              thumbColor={masterFeedbackEnabled ? theme.colors.primary : theme.colors.textMuted}
            />
          </View>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={[theme.typography.body, { color: theme.colors.text }]}>Sonidos de juego</Text>
            <Switch
              value={feedbackPrefs?.soundEnabled ?? true}
              onValueChange={(value) => {
                toggleFeedback({ soundEnabled: value });
              }}
              disabled={!masterFeedbackEnabled || isUpdatingFeedback}
              trackColor={{ false: theme.colors.border, true: theme.colors.primarySoft }}
              thumbColor={feedbackPrefs?.soundEnabled ? theme.colors.primary : theme.colors.textMuted}
            />
          </View>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={[theme.typography.body, { color: theme.colors.text }]}>Vibración / háptica</Text>
            <Switch
              value={feedbackPrefs?.hapticsEnabled ?? true}
              onValueChange={(value) => {
                toggleFeedback({ hapticsEnabled: value });
              }}
              disabled={!masterFeedbackEnabled || isUpdatingFeedback}
              trackColor={{ false: theme.colors.border, true: theme.colors.primarySoft }}
              thumbColor={feedbackPrefs?.hapticsEnabled ? theme.colors.primary : theme.colors.textMuted}
            />
          </View>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={[theme.typography.body, { color: theme.colors.text }]}>Celebración visual</Text>
            <Switch
              value={feedbackPrefs?.celebrationEnabled ?? true}
              onValueChange={(value) => {
                toggleFeedback({ celebrationEnabled: value });
              }}
              disabled={!masterFeedbackEnabled || isUpdatingFeedback}
              trackColor={{ false: theme.colors.border, true: theme.colors.primarySoft }}
              thumbColor={feedbackPrefs?.celebrationEnabled ? theme.colors.primary : theme.colors.textMuted}
            />
          </View>
        </View>

        <Text style={[theme.typography.bodySmall, { color: theme.colors.textMuted, marginTop: 10 }]}>Estos ajustes se aplican automáticamente a todos los juegos.</Text>
      </Card>

      <Card>
        <Text style={[theme.typography.h3, { color: theme.colors.text }]}>🌿 Ambiente de concentración</Text>
        <Text style={[theme.typography.bodySmall, { color: theme.colors.textMuted, marginTop: 6 }]}>Solo suena durante partidas y puedes apagarlo cuando quieras.</Text>
        <View style={{ marginTop: 10, gap: 8 }}>
          {focusAudioOptions.map((option) => {
            const isSelected = (feedbackPrefs?.focusAudioMode ?? 'lluvia') === option.mode;
            return (
              <Button
                key={option.mode}
                title={isSelected ? `✓ ${option.label}` : option.label}
                variant={isSelected ? 'primary' : 'secondary'}
                disabled={isUpdatingFeedback}
                onPress={() => {
                  toggleFeedback({ focusAudioMode: option.mode });
                }}
              />
            );
          })}
        </View>
      </Card>

      <Pressable
        onPress={confirmReset}
        style={({ pressed }) => [
          styles.dangerButton,
          {
            borderColor: theme.colors.red,
            backgroundColor: pressed ? `${theme.colors.red}15` : 'transparent',
            opacity: pressed ? 0.9 : 1,
          },
        ]}
      >
        <Text style={[theme.typography.label, { color: theme.colors.red }]}>🗑 Reiniciar progreso</Text>
      </Pressable>

      {__DEV__ ? (
        <Card>
          <Text style={[theme.typography.h3, { color: theme.colors.text }]}>Herramientas de desarrollo</Text>
          <View style={{ marginTop: 10, gap: 8 }}>
            <Button
              title="Reiniciar perfil"
              variant="secondary"
              onPress={() => confirmDevReset('Reiniciar perfil', 'Borra perfil y nivel.', resetProfile)}
            />
            <Button
              title="Reiniciar estadísticas"
              variant="secondary"
              onPress={() => confirmDevReset('Reiniciar estadísticas', 'Borra estadísticas de juegos.', resetStats)}
            />
            <Button
              title="Reiniciar temporada/SP"
              variant="secondary"
               onPress={() =>
                 confirmDevReset('Reiniciar temporada', 'Reinicia temporada, SP y liga.', async () => {
                   await resetSeasonProgress();
                 })
               }
            />
            <Button
              title="Reiniciar todo"
              variant="ghost"
              onPress={() => confirmDevReset('Reiniciar todo', 'Borra perfil, estadísticas, reto diario y estados de juegos.', resetAllDebug)}
            />
          </View>
        </Card>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  dangerButton: {
    minHeight: 52,
    borderWidth: 1,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
});