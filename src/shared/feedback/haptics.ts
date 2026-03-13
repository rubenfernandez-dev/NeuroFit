import * as Haptics from 'expo-haptics';
import { Platform, Vibration } from 'react-native';
import { logWarning } from '../observability';

async function safeHaptic(action: () => Promise<void>) {
  try {
    await action();
  } catch (error) {
    // Best-effort feedback: gameplay should never fail due to haptics.
    logWarning('feedback.haptics.trigger_failed', {
      reason: error instanceof Error ? error.message : 'unknown_error',
    });
  }
}

export async function triggerVictoryHaptic() {
  await safeHaptic(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
}

export async function triggerDefeatHaptic() {
  await safeHaptic(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));
}

export async function triggerErrorHaptic() {
  await safeHaptic(async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (Platform.OS === 'android') Vibration.vibrate(20);
  });
}

export async function triggerSuccessHaptic() {
  await safeHaptic(() => Haptics.selectionAsync());
}
