import { triggerCelebration } from './celebration';
import { triggerDefeatHaptic, triggerErrorHaptic, triggerSuccessHaptic, triggerVictoryHaptic } from './haptics';
import { playDefeatSound, playErrorSound, playSuccessSound, playVictorySound } from './sounds';
import { FocusAudioMode, setFocusAudioMode, stopFocusAmbient } from './focusAudio';

export type GameFeedbackPreferences = {
  enabled: boolean;
  soundEnabled: boolean;
  hapticsEnabled: boolean;
  celebrationEnabled: boolean;
  focusAudioMode: FocusAudioMode;
};

const prefs: GameFeedbackPreferences = {
  enabled: true,
  soundEnabled: true,
  hapticsEnabled: true,
  celebrationEnabled: true,
  focusAudioMode: 'silencio',
};

export function updateGameFeedbackPreferences(next: Partial<GameFeedbackPreferences>) {
  Object.assign(prefs, next);
  if (next.focusAudioMode) {
    setFocusAudioMode(next.focusAudioMode);
  }
}

export function getGameFeedbackPreferences(): GameFeedbackPreferences {
  return { ...prefs };
}

export async function playVictoryFeedback() {
  if (!prefs.enabled) return;

  void stopFocusAmbient({ fadeOutMs: 500 });
  if (prefs.soundEnabled) await playVictorySound();
  if (prefs.hapticsEnabled) await triggerVictoryHaptic();
  if (prefs.celebrationEnabled) triggerCelebration({ durationMs: 1800, particleCount: 34 });
}

export async function playDefeatFeedback() {
  if (!prefs.enabled) return;

  void stopFocusAmbient({ fadeOutMs: 420 });
  if (prefs.soundEnabled) await playDefeatSound();
  if (prefs.hapticsEnabled) await triggerDefeatHaptic();
}

export async function playErrorFeedback() {
  if (!prefs.enabled) return;

  if (prefs.soundEnabled) await playErrorSound();
  if (prefs.hapticsEnabled) await triggerErrorHaptic();
}

export async function playSuccessFeedback() {
  if (!prefs.enabled) return;

  if (prefs.soundEnabled) await playSuccessSound();
  if (prefs.hapticsEnabled) await triggerSuccessHaptic();
}
