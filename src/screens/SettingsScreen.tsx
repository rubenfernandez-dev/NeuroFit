import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Linking, ScrollView, Switch, Text, View } from 'react-native';
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

const options: ThemePreference[] = ['system', 'light', 'dark'];

export default function SettingsScreen() {
  const { theme, preference, setPreference } = useAppTheme();
  const [prefs, setPrefs] = useState<NotificationPrefs | null>(null);
  const [permissionsDenied, setPermissionsDenied] = useState(false);

  useEffect(() => {
    getNotificationPrefs().then(setPrefs);
  }, []);

  const displayTime = useMemo(() => {
    const hour = String(prefs?.hour ?? 20).padStart(2, '0');
    const minute = String(prefs?.minute ?? 0).padStart(2, '0');
    return `${hour}:${minute}`;
  }, [prefs]);

  const confirmReset = () => {
    Alert.alert('Reset progreso', 'Esto borrará stats y perfil.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Reset',
        style: 'destructive',
        onPress: async () => {
          await Promise.all([resetStats(), resetProfile()]);
        },
      },
    ]);
  };

  const toggleReminder = async (enabled: boolean) => {
    const current = prefs ?? (await getNotificationPrefs());

    if (!enabled) {
      if (current.notificationId) {
        await cancelDailyReminder(current.notificationId);
      }
      const updated = await updateNotificationPrefs({ enabled: false, notificationId: undefined });
      setPrefs(updated);
      setPermissionsDenied(false);
      return;
    }

    const granted = await requestNotifPermissions();
    if (!granted) {
      if (current.notificationId) {
        await cancelDailyReminder(current.notificationId);
      }
      const updated = await updateNotificationPrefs({ enabled: false, notificationId: undefined });
      setPrefs(updated);
      setPermissionsDenied(true);
      return;
    }

    await ensureAndroidChannel();
    const notificationId = await scheduleDailyReminder(current.hour, current.minute);
    const updated = await updateNotificationPrefs({ enabled: true, notificationId });
    setPrefs(updated);
    setPermissionsDenied(false);
  };

  const updateTime = async (kind: 'hour' | 'minute', delta: number) => {
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
    if (current.enabled) {
      if (current.notificationId) {
        await cancelDailyReminder(current.notificationId);
      }
      await ensureAndroidChannel();
      nextId = await scheduleDailyReminder(hour, minute);
    }

    const updated = await updateNotificationPrefs({ hour, minute, notificationId: nextId });
    setPrefs(updated);
  };

  const openSystemSettings = async () => {
    try {
      if (typeof Linking.openSettings === 'function') {
        await Linking.openSettings();
        return;
      }
    } catch {
    }

    try {
      await Linking.openURL('app-settings:');
    } catch {
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
      deleteItem(STORAGE_KEYS.sudokuState),
      deleteItem(STORAGE_KEYS.memoryState),
      deleteItem(STORAGE_KEYS.mentalMathState),
      deleteItem(STORAGE_KEYS.leaderboard),
    ]);
  };

  return (
    <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.md }}>
      <Card>
        <Text style={[theme.typography.h3, { color: theme.colors.text }]}>Tema</Text>
        <View style={{ gap: 8, marginTop: 10 }}>
          {options.map((option) => (
            <Button
              key={option}
              title={option === preference ? `✓ ${option}` : option}
              variant={option === preference ? 'primary' : 'secondary'}
              onPress={() => setPreference(option)}
            />
          ))}
        </View>
      </Card>

      <Card>
        <Text style={[theme.typography.h3, { color: theme.colors.text }]}>Recordatorio diario</Text>
        <View style={{ marginTop: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={[theme.typography.body, { color: theme.colors.text }]}>Recordatorio diario</Text>
          <Switch
            value={prefs?.enabled ?? false}
            onValueChange={toggleReminder}
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
            <Button title="Hora -" variant="secondary" onPress={() => updateTime('hour', -1)} style={{ flex: 1 }} />
            <Button title="Hora +" variant="secondary" onPress={() => updateTime('hour', 1)} style={{ flex: 1 }} />
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button title="Min -5" variant="secondary" onPress={() => updateTime('minute', -5)} style={{ flex: 1 }} />
            <Button title="Min +5" variant="secondary" onPress={() => updateTime('minute', 5)} style={{ flex: 1 }} />
          </View>
        </View>
      </Card>

      <Button title="Reset progreso" onPress={confirmReset} variant="ghost" />

      {__DEV__ ? (
        <Card>
          <Text style={[theme.typography.h3, { color: theme.colors.text }]}>Debug (solo desarrollo)</Text>
          <View style={{ marginTop: 10, gap: 8 }}>
            <Button
              title="Reset perfil"
              variant="secondary"
              onPress={() => confirmDevReset('Reset perfil', 'Borra perfil y nivel.', resetProfile)}
            />
            <Button
              title="Reset stats"
              variant="secondary"
              onPress={() => confirmDevReset('Reset stats', 'Borra estadísticas de juegos.', resetStats)}
            />
            <Button
              title="Reset season/SP"
              variant="secondary"
               onPress={() =>
                 confirmDevReset('Reset season', 'Reinicia temporada, SP y liga.', async () => {
                   await resetSeasonProgress();
                 })
               }
            />
            <Button
              title="Reset todo"
              variant="ghost"
              onPress={() => confirmDevReset('Reset todo', 'Borra perfil, stats, daily y estados de juegos.', resetAllDebug)}
            />
          </View>
        </Card>
      ) : null}
    </ScrollView>
  );
}