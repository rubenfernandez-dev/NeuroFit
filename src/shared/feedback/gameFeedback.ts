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
  focusAudioMode: 'lluvia',
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

function wait(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function playVictoryFeedback() {
  if (!prefs.enabled) return;

  if (prefs.celebrationEnabled) triggerCelebration({ durationMs: 2200, particleCount: 52 });
  await stopFocusAmbient({ fadeOutMs: 120 });

  const tasks: Array<Promise<unknown>> = [];
  if (prefs.soundEnabled) {
    tasks.push(
      wait(40).then(() => playVictorySound()),
    );
  }
  if (prefs.hapticsEnabled) {
    tasks.push(
      wait(40).then(() => triggerVictoryHaptic()),
    );
  }

  if (tasks.length > 0) {
    await Promise.allSettled(tasks);
  }
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
