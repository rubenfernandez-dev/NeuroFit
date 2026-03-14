import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from 'expo-av';
import { logWarning } from '../observability';

type SoundKind = 'victory' | 'defeat' | 'error' | 'success';

const SOUND_ASSETS: Record<SoundKind, number> = {
  victory: require('../../../assets/feedback/victory.wav'),
  defeat: require('../../../assets/feedback/defeat.wav'),
  error: require('../../../assets/feedback/error.wav'),
  success: require('../../../assets/feedback/success.wav'),
};

const SOUND_VOLUME: Record<SoundKind, number> = {
  victory: 0.78,
  defeat: 0.4,
  error: 0.3,
  success: 0.2,
};

const SOUND_RATE: Record<SoundKind, number> = {
  victory: 1.03,
  defeat: 1,
  error: 1,
  success: 1,
};

let audioConfigured = false;

async function ensureAudioConfigured() {
  if (audioConfigured) return;
  await Audio.setAudioModeAsync({
    allowsRecordingIOS: false,
    playsInSilentModeIOS: true,
    interruptionModeIOS: InterruptionModeIOS.DuckOthers,
    interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
    shouldDuckAndroid: true,
    staysActiveInBackground: false,
    playThroughEarpieceAndroid: false,
  });
  audioConfigured = true;
}

async function playSound(kind: SoundKind) {
  try {
    await ensureAudioConfigured();
    const { sound } = await Audio.Sound.createAsync(SOUND_ASSETS[kind], {
      shouldPlay: true,
      volume: SOUND_VOLUME[kind],
      rate: SOUND_RATE[kind],
      shouldCorrectPitch: true,
      isLooping: false,
      progressUpdateIntervalMillis: 250,
    });

    sound.setOnPlaybackStatusUpdate((status) => {
      if (!status.isLoaded) return;
      if (status.didJustFinish) {
        sound.unloadAsync();
      }
    });
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
