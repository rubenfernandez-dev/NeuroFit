import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { logWarning } from '../observability';

type SoundKind = 'victory' | 'defeat' | 'error' | 'success';

const SOUND_ASSETS: Record<SoundKind, number> = {
  victory: require('../../../assets/feedback/victory.wav'),
  defeat: require('../../../assets/feedback/defeat.wav'),
  error: require('../../../assets/feedback/error.wav'),
  success: require('../../../assets/feedback/success.wav'),
};

const SOUND_VOLUME: Record<SoundKind, number> = {
  victory: 0.96,
  defeat: 0.4,
  error: 0.3,
  success: 0.2,
};

let audioConfigured = false;
const activePlayers = new Set<ReturnType<typeof createAudioPlayer>>();

async function ensureAudioConfigured() {
  if (audioConfigured) return;
  await setAudioModeAsync({
    playsInSilentMode: true,
    shouldPlayInBackground: false,
    interruptionMode: 'duckOthers',
  });
  audioConfigured = true;
}

async function playSound(kind: SoundKind) {
  try {
    await ensureAudioConfigured();
    const player = createAudioPlayer(SOUND_ASSETS[kind], {
      updateInterval: 250,
      keepAudioSessionActive: true,
    });
    player.volume = SOUND_VOLUME[kind];
    player.loop = false;

    activePlayers.add(player);
    const subscription = player.addListener('playbackStatusUpdate', (status) => {
      if (!status.didJustFinish) return;
      subscription.remove();
      activePlayers.delete(player);
      player.remove();
    });

    player.play();
  } catch (error) {
    // Best-effort feedback: gameplay should never fail due to audio issues.
    logWarning('feedback.audio.play_failed', {
      kind,
      reason: error instanceof Error ? error.message : 'unknown_error',
    });
  }
}

export async function playVictorySound() {
  await playSound('victory');
}

export async function playDefeatSound() {
  await playSound('defeat');
}

export async function playErrorSound() {
  await playSound('error');
}

export async function playSuccessSound() {
  await playSound('success');
}
