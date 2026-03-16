import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { captureException, logWarning } from '../observability';

export type FocusAudioMode = 'silencio' | 'suave' | 'profundo' | 'lluvia' | 'naturaleza';

type FocusStartOptions = {
  fadeInMs?: number;
};

type FocusStopOptions = {
  fadeOutMs?: number;
};

const SOURCES: Record<Exclude<FocusAudioMode, 'silencio'>, number> = {
  suave: require('../../../assets/focus/soft.wav'),
  profundo: require('../../../assets/focus/deep.wav'),
  lluvia: require('../../../assets/focus/rain.wav'),
  naturaleza: require('../../../assets/focus/nature.wav'),
};

const TARGET_VOLUME: Record<Exclude<FocusAudioMode, 'silencio'>, number> = {
  suave: 0.2,
  profundo: 0.28,
  lluvia: 0.34,
  naturaleza: 0.32,
};

let configured = false;
let mode: FocusAudioMode = 'silencio';
let player: ReturnType<typeof createAudioPlayer> | null = null;
let activeSource: Exclude<FocusAudioMode, 'silencio'> | null = null;
let fadeInterval: ReturnType<typeof setInterval> | null = null;
let operationId = 0;
let playing = false;

async function ensureAudioConfigured() {
  if (configured) return;

  await setAudioModeAsync({
    playsInSilentMode: true,
    shouldPlayInBackground: false,
    interruptionMode: 'duckOthers',
  });
  configured = true;
}

function clearFadeInterval() {
  if (!fadeInterval) return;
  clearInterval(fadeInterval);
  fadeInterval = null;
}

function runVolumeFade(targetVolume: number, durationMs: number, opId: number) {
  if (!player) return;

  clearFadeInterval();
  const safeDuration = Math.max(80, durationMs);
  const steps = Math.max(3, Math.round(safeDuration / 50));
  const startVolume = Number.isFinite(player.volume) ? player.volume : 0;
  let step = 0;

  fadeInterval = setInterval(() => {
    if (!player || opId !== operationId) {
      clearFadeInterval();
      return;
    }

    step += 1;
    const progress = Math.min(1, step / steps);
    player.volume = startVolume + (targetVolume - startVolume) * progress;

    if (progress >= 1) {
      clearFadeInterval();
    }
  }, Math.max(16, Math.floor(safeDuration / steps)));
}

function ensurePlayer(nextSource: Exclude<FocusAudioMode, 'silencio'>) {
  if (!player) {
    player = createAudioPlayer(SOURCES[nextSource], {
      updateInterval: 500,
      keepAudioSessionActive: true,
    });
    player.loop = true;
    activeSource = nextSource;
    return;
  }

  if (activeSource !== nextSource) {
    player.replace(SOURCES[nextSource]);
    activeSource = nextSource;
  }
}

export function setFocusAudioMode(nextMode: FocusAudioMode) {
  mode = nextMode;

  if (mode === 'silencio') {
    void stopFocusAmbient({ fadeOutMs: 260 });
  }
}

export function getFocusAudioMode(): FocusAudioMode {
  return mode;
}

export async function startFocusAmbient(options?: FocusStartOptions) {
  const opId = ++operationId;

  if (mode === 'silencio') {
    await stopFocusAmbient({ fadeOutMs: 180 });
    return;
  }

  try {
    await ensureAudioConfigured();

    const selected = mode as Exclude<FocusAudioMode, 'silencio'>;
    ensurePlayer(selected);

    if (!player) return;

    player.volume = Math.max(0, Math.min(1, player.volume));

    if (!playing) {
      player.play();
      playing = true;
    }

    runVolumeFade(TARGET_VOLUME[selected], options?.fadeInMs ?? 620, opId);
  } catch (error) {
    captureException(error, { area: 'feedback.focusAudio.start', mode });
  }
}

export async function stopFocusAmbient(options?: FocusStopOptions) {
  const opId = ++operationId;

  if (!player) {
    clearFadeInterval();
    playing = false;
    return;
  }

  try {
    const fadeOutMs = options?.fadeOutMs ?? 420;
    runVolumeFade(0, fadeOutMs, opId);

    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        clearTimeout(timeout);
        resolve();
      }, Math.max(80, fadeOutMs + 30));
    });

    if (!player || opId !== operationId) return;

    player.pause();
    playing = false;
  } catch (error) {
    logWarning('feedback.focusAudio.stop_failed', {
      reason: error instanceof Error ? error.message : 'unknown_error',
    });
    captureException(error, { area: 'feedback.focusAudio.stop' });
  }
}

export function disposeFocusAmbient() {
  operationId += 1;
  clearFadeInterval();

  if (!player) return;

  player.pause();
  player.remove();
  player = null;
  activeSource = null;
  playing = false;
}

