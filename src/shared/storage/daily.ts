import { Difficulty, GameId, normalizeDifficulty } from '../../games/types';
import { STORAGE_KEYS } from './keys';
import { getLocalDayKey, getUtcDayKey } from '../utils/time';
import { createSeededRng, pickOne, randomInt } from '../utils/random';
import { getDailySeed, hashString } from '../utils/seed';
import { logEvent, logWarn } from '../../core/telemetry';
import { deleteItem, getItem, setItem } from './secureStore';
import { getProfile, updateProfile } from './profile';
import { applyDailyCompletionToStreak } from '../gamification/streak';
import { nowISO } from '../utils/time';
import { migrateLegacyUtcDailyToLocalDay } from './dailyDay';
import { captureException, logWarning } from '../observability';

type DailyStageGameId = 'mentalmath' | 'memory' | 'sudoku' | 'speedmatch' | 'patternmemory' | 'focusgrid';

export type DailyStageResult = {
  durationMs?: number;
  mistakes?: number;
  score?: number;
};

export type DailyStage = {
  gameId: DailyStageGameId;
  difficulty: Difficulty;
  seed: number;
  completed: boolean;
  startedAtISO?: string;
  completedAtISO?: string;
  result?: DailyStageResult;
};

export type DailyStatus = 'not_started' | 'in_progress' | 'completed';

export type DailyState = {
  dateISO: string;
  lastDailyDateISO: string;
  status: DailyStatus;
  completed: boolean;
  rewardClaimed: boolean;
  claimedRewardAtISO?: string;
  dailySeed: number;
  stages: [DailyStage, DailyStage, DailyStage];
  currentStageIndex: number;
  startedAtISO?: string;
  completedAtISO?: string;
};

type CompleteDailyStageInput = {
  stageIndex?: number;
  gameId: GameId;
  difficulty: Difficulty;
  result?: DailyStageResult;
};

const DAILY_STAGE_POOL: DailyStageGameId[] = ['mentalmath', 'memory', 'sudoku', 'speedmatch', 'patternmemory', 'focusgrid'];
const DIFFICULTY_POOL: Difficulty[] = ['principiante', 'avanzado', 'experto', 'maestro', 'gran_maestro'];

// ─── Game families ───────────────────────────────────────────────────────────
type GameFamily = 'memory' | 'logic' | 'speed';

const GAME_FAMILY: Record<DailyStageGameId, GameFamily> = {
  memory: 'memory',
  patternmemory: 'memory',
  sudoku: 'logic',
  mentalmath: 'logic',
  speedmatch: 'speed',
  focusgrid: 'speed',
};

const FAMILY_POOL: Record<GameFamily, DailyStageGameId[]> = {
  memory: ['memory', 'patternmemory'],
  logic: ['sudoku', 'mentalmath'],
  speed: ['speedmatch', 'focusgrid'],
};

// Orden fijo de stages: speed → memory → logic
const STAGE_FAMILY_ORDER: GameFamily[] = ['speed', 'memory', 'logic'];

type LastDailyCircuit = {
  dateISO: string;
  games: DailyStageGameId[];
};

// ─── User seed persistente ───────────────────────────────────────────────────
async function getOrCreateDailyUserSeed(): Promise<number> {
  const raw = await getItem(STORAGE_KEYS.dailyUserSeed);
  if (raw !== null && raw !== undefined) {
    const parsed = parseInt(raw, 10);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }
  const seed = ((Math.floor(Math.random() * 0xFFFFFFFE) + 1) >>> 0) || 1;
  await setItem(STORAGE_KEYS.dailyUserSeed, String(seed));
  return seed;
}

// ─── Persistencia del último circuito ───────────────────────────────────────
async function getLastDailyCircuit(): Promise<LastDailyCircuit | null> {
  const raw = await getItem(STORAGE_KEYS.lastDailyCircuit);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (typeof parsed.dateISO === 'string' && Array.isArray(parsed.games)) {
      return { dateISO: parsed.dateISO, games: parsed.games as DailyStageGameId[] };
    }
    return null;
  } catch {
    return null;
  }
}

async function saveLastDailyCircuit(circuit: LastDailyCircuit): Promise<void> {
  await setItem(STORAGE_KEYS.lastDailyCircuit, JSON.stringify(circuit));
}

// ─── Constructor de circuito determinista ────────────────────────────────────
function buildDailyCircuit({
  dateISO,
  userSeed,
  yesterdayGames,
}: {
  dateISO: string;
  userSeed: number;
  yesterdayGames?: DailyStageGameId[];
}): [DailyStageGameId, DailyStageGameId, DailyStageGameId] {
  const combinedSeed = hashString(`${dateISO}:${userSeed}`);
  const rng = createSeededRng(combinedSeed);

  const selected = STAGE_FAMILY_ORDER.map((family) => {
    const pool = FAMILY_POOL[family];
    const preferred = yesterdayGames
      ? pool.filter((g) => !yesterdayGames.includes(g))
      : pool;
    return pickOne(preferred.length > 0 ? preferred : pool, rng);
  });

  return selected as [DailyStageGameId, DailyStageGameId, DailyStageGameId];
}

// ─── Build stages a partir de juegos seleccionados ───────────────────────────
function buildStagesFromGames(
  dailySeed: number,
  games: [DailyStageGameId, DailyStageGameId, DailyStageGameId],
): [DailyStage, DailyStage, DailyStage] {
  const rng = createSeededRng(dailySeed);
  return games.map((gameId, index) => ({
    gameId,
    difficulty: pickOne(DIFFICULTY_POOL, rng),
    seed: randomInt(1, 2_147_483_647, rng) + index,
    completed: false,
  })) as [DailyStage, DailyStage, DailyStage];
}

// ─── Validación en desarrollo ────────────────────────────────────────────────
function validateDaily(games: DailyStageGameId[]): void {
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    if (games.length !== 3) {
      throw new Error(`validateDaily: se esperaban 3 juegos, se obtuvieron ${games.length}`);
    }
    if (new Set(games).size !== 3) {
      throw new Error(`validateDaily: juegos duplicados: ${games.join(', ')}`);
    }
    const families = games.map((g) => GAME_FAMILY[g]);
    if (new Set(families).size !== 3) {
      throw new Error(`validateDaily: cobertura de familia incompleta – familias: ${families.join(', ')}`);
    }
  }
}

// ─── Helpers de seguridad ────────────────────────────────────────────────────
function sanitizeStageIndex(raw: unknown, fallback: number, dateISO?: unknown): number {
  if (typeof raw !== 'number') return fallback;
  const floored = Math.floor(raw);
  const clamped = Math.max(0, Math.min(3, floored));
  if (clamped !== floored) {
    logWarn('daily_invalid_state_detected', {
      reason: 'currentStageIndex_out_of_range',
      raw,
      corrected: clamped,
      dateISO: typeof dateISO === 'string' ? dateISO : undefined,
    });
  }
  return clamped;
}

let dailyMutationQueue: Promise<void> = Promise.resolve();

function runDailyMutation<T>(operation: () => Promise<T>): Promise<T> {
  const next = dailyMutationQueue.then(operation, operation);
  dailyMutationQueue = next.then(() => undefined, () => undefined);
  return next;
}

function getCurrentStageIndex(stages: DailyStage[]): number {
  const pendingIndex = stages.findIndex((stage) => !stage.completed);
  return pendingIndex < 0 ? stages.length : pendingIndex;
}

function deriveStatus(stages: DailyStage[], completed: boolean): DailyStatus {
  if (completed || stages.every((stage) => stage.completed)) return 'completed';
  if (stages.some((stage) => stage.completed || !!stage.startedAtISO)) return 'in_progress';
  return 'not_started';
}

function normalizeResult(result?: DailyStageResult): DailyStageResult | undefined {
  if (!result) return undefined;
  const normalized: DailyStageResult = {};
  if (typeof result.durationMs === 'number') normalized.durationMs = Math.max(0, Math.floor(result.durationMs));
  if (typeof result.mistakes === 'number') normalized.mistakes = Math.max(0, Math.floor(result.mistakes));
  if (typeof result.score === 'number') normalized.score = Math.max(0, Math.floor(result.score));
  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function buildStages(dailySeed: number): [DailyStage, DailyStage, DailyStage] {
  const rng = createSeededRng(dailySeed);
  const startOffset = randomInt(0, DAILY_STAGE_POOL.length - 1, rng);
  const stageGameIds = [0, 1, 2].map((offset) => DAILY_STAGE_POOL[(startOffset + offset) % DAILY_STAGE_POOL.length]);

  const stages = stageGameIds.map((gameId, index) => ({
    gameId,
    difficulty: pickOne(DIFFICULTY_POOL, rng),
    seed: randomInt(1, 2_147_483_647, rng) + index,
    completed: false,
  })) as [DailyStage, DailyStage, DailyStage];

  return stages;
}

const defaultDaily = (dateISO: string): DailyState => {
  const dailySeed = getDailySeed(dateISO);
  const stages = buildStages(dailySeed);

  return {
    dateISO,
    lastDailyDateISO: dateISO,
    status: 'not_started',
    completed: false,
    rewardClaimed: false,
    dailySeed,
    stages,
    currentStageIndex: 0,
  };
};

function normalizeStage(stage: unknown, fallback: DailyStage): DailyStage {
  if (!stage || typeof stage !== 'object') return fallback;
  const parsed = stage as Partial<DailyStage>;
  const gameId = parsed.gameId === 'mentalmath' || parsed.gameId === 'memory' || parsed.gameId === 'sudoku' || parsed.gameId === 'speedmatch' || parsed.gameId === 'patternmemory' || parsed.gameId === 'focusgrid'
    ? parsed.gameId
    : fallback.gameId;

  return {
    gameId,
    difficulty: normalizeDifficulty(parsed.difficulty, fallback.difficulty),
    seed: typeof parsed.seed === 'number' ? Math.max(1, Math.floor(parsed.seed)) : fallback.seed,
    completed: Boolean(parsed.completed),
    startedAtISO: typeof parsed.startedAtISO === 'string' ? parsed.startedAtISO : undefined,
    completedAtISO: typeof parsed.completedAtISO === 'string' ? parsed.completedAtISO : undefined,
    result: normalizeResult(parsed.result),
  };
}

function fromLegacyOrNull(parsed: Record<string, unknown>): DailyState | null {
  const lastDailyDateISO = typeof parsed.lastDailyDateISO === 'string' ? parsed.lastDailyDateISO : null;
  const dailySeed = typeof parsed.dailySeed === 'number' ? parsed.dailySeed : null;
  if (!lastDailyDateISO || !dailySeed) return null;

  const base = defaultDaily(lastDailyDateISO);
  const legacyCompleted = Boolean(parsed.completed);
  const rewardClaimed = Boolean(parsed.rewardClaimed);
  const stages = legacyCompleted
    ? base.stages.map((stage) => ({ ...stage, completed: true })) as [DailyStage, DailyStage, DailyStage]
    : base.stages;

  return {
    ...base,
    dateISO: lastDailyDateISO,
    dailySeed,
    status: legacyCompleted ? 'completed' : 'not_started',
    rewardClaimed,
    completed: legacyCompleted,
    stages,
    currentStageIndex: legacyCompleted ? 3 : 0,
    claimedRewardAtISO: rewardClaimed ? nowISO() : undefined,
    completedAtISO: legacyCompleted ? nowISO() : undefined,
  };
}

export async function getDaily(): Promise<DailyState | null> {
  const raw = await getItem(STORAGE_KEYS.daily);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;

    if (Array.isArray(parsed.stages) && typeof parsed.lastDailyDateISO === 'string' && typeof parsed.dailySeed === 'number') {
      const base = defaultDaily(parsed.lastDailyDateISO);
      const parsedStages = parsed.stages as unknown[];
      const normalizedStages = base.stages.map((fallback, index) => normalizeStage(parsedStages[index], fallback)) as [DailyStage, DailyStage, DailyStage];
      const derivedIndex = getCurrentStageIndex(normalizedStages);
      const computedCompleted = Boolean(parsed.completed) || derivedIndex >= 3;
      const computedStatus =
        parsed.status === 'not_started' || parsed.status === 'in_progress' || parsed.status === 'completed'
          ? parsed.status
          : deriveStatus(normalizedStages, computedCompleted);
      const dateISO = typeof parsed.dateISO === 'string' ? parsed.dateISO : parsed.lastDailyDateISO;

      return {
        dateISO,
        lastDailyDateISO: parsed.lastDailyDateISO,
        status: computedStatus,
        completed: computedCompleted,
        rewardClaimed: Boolean(parsed.rewardClaimed),
        claimedRewardAtISO: typeof parsed.claimedRewardAtISO === 'string' ? parsed.claimedRewardAtISO : undefined,
        dailySeed: parsed.dailySeed,
        stages: normalizedStages,
        currentStageIndex: sanitizeStageIndex(parsed.currentStageIndex, derivedIndex, parsed.lastDailyDateISO),
        startedAtISO: typeof parsed.startedAtISO === 'string' ? parsed.startedAtISO : undefined,
        completedAtISO: typeof parsed.completedAtISO === 'string' ? parsed.completedAtISO : undefined,
      };
    }

    return fromLegacyOrNull(parsed);
  } catch (error) {
    logWarning('storage.daily.corrupt_or_invalid', { storageKey: STORAGE_KEYS.daily });
    captureException(error, { area: 'storage.daily.getDaily', category: 'corrupt_data' });
    await deleteItem(STORAGE_KEYS.daily);
    return null;
  }
}

export async function ensureDailyToday(): Promise<DailyState> {
  const current = await getDaily();
  const localTodayKey = getLocalDayKey();
  const utcTodayKey = getUtcDayKey();
  const migratedCurrent = current ? migrateLegacyUtcDailyToLocalDay(current, localTodayKey, utcTodayKey) : null;
  const effectiveCurrent = migratedCurrent ?? current;

  if (effectiveCurrent && effectiveCurrent.lastDailyDateISO === localTodayKey) {
    const currentDaily = effectiveCurrent;
    const completed = currentDaily.completed || currentDaily.stages.every((stage) => stage.completed);
    const status = deriveStatus(currentDaily.stages, completed);
    const normalized: DailyState = {
      ...currentDaily,
      dateISO: localTodayKey,
      lastDailyDateISO: localTodayKey,
      currentStageIndex: completed ? 3 : getCurrentStageIndex(currentDaily.stages),
      completed,
      status,
      claimedRewardAtISO: currentDaily.rewardClaimed ? currentDaily.claimedRewardAtISO ?? nowISO() : undefined,
    };

    if (JSON.stringify(normalized) !== JSON.stringify(currentDaily)) {
      await setItem(STORAGE_KEYS.daily, JSON.stringify(normalized));
    }
    logEvent('daily_loaded_existing', { dateISO: localTodayKey, status: normalized.status, currentStageIndex: normalized.currentStageIndex });
    return normalized;
  }

  const [userSeed, lastCircuit] = await Promise.all([
    getOrCreateDailyUserSeed(),
    getLastDailyCircuit(),
  ]);

  const yesterdayGames =
    lastCircuit !== null && lastCircuit.dateISO !== localTodayKey
      ? (lastCircuit.games as DailyStageGameId[])
      : undefined;

  const dailySeed = getDailySeed(localTodayKey);
  const games = buildDailyCircuit({ dateISO: localTodayKey, userSeed, yesterdayGames });
  validateDaily(games);
  const stages = buildStagesFromGames(dailySeed, games);

  const fresh: DailyState = {
    dateISO: localTodayKey,
    lastDailyDateISO: localTodayKey,
    status: 'not_started',
    completed: false,
    rewardClaimed: false,
    dailySeed,
    stages,
    currentStageIndex: 0,
  };

  await saveLastDailyCircuit({ dateISO: localTodayKey, games: Array.from(games) });
  await setItem(STORAGE_KEYS.daily, JSON.stringify(fresh));
  logEvent('daily_created', { dateISO: localTodayKey, games: Array.from(games) });
  return fresh;
}

async function markDailyCompletedInternal(): Promise<DailyState> {
  const current = (await ensureDailyToday()) as DailyState;
  const todayISO = current.lastDailyDateISO;
  const next: DailyState = current.completed
    ? { ...current, status: 'completed', dateISO: todayISO, completedAtISO: current.completedAtISO ?? nowISO() }
    : {
        ...current,
        dateISO: todayISO,
        completed: true,
        status: 'completed',
        currentStageIndex: 3,
        completedAtISO: nowISO(),
        lastDailyDateISO: todayISO,
      };

  if (!current.completed) {
    await setItem(STORAGE_KEYS.daily, JSON.stringify(next));
  }

  const profile = await getProfile();
  if (profile.lastDailyCompletedISO === todayISO) {
    return next;
  }

  const { profile: streakUpdated } = applyDailyCompletionToStreak(profile, todayISO);
  await updateProfile({
    streakCurrent: streakUpdated.streakCurrent,
    streakBest: streakUpdated.streakBest,
    lastDailyCompletedISO: streakUpdated.lastDailyCompletedISO,
  });

  return next;
}

export async function markDailyCompleted(): Promise<DailyState> {
  return runDailyMutation(markDailyCompletedInternal);
}

export async function completeDailyStage(input: CompleteDailyStageInput): Promise<{
  daily: DailyState;
  stageCompletedNow: boolean;
  circuitCompletedNow: boolean;
  alreadyCompleted: boolean;
}> {
  return runDailyMutation(async () => {
    const current = await ensureDailyToday();

    if (current.completed) {
      logWarn('daily_stage_complete_skipped_already_completed', { dateISO: current.dateISO, gameId: input.gameId, reason: 'circuit_already_completed' });
      return {
        daily: current,
        stageCompletedNow: false,
        circuitCompletedNow: false,
        alreadyCompleted: true,
      };
    }

    const index = typeof input.stageIndex === 'number'
      ? Math.max(0, Math.min(2, Math.floor(input.stageIndex)))
      : current.currentStageIndex;

    const stage = current.stages[index];
    if (!stage || stage.gameId !== input.gameId) {
      logWarn('daily_invalid_state_detected', { reason: 'stage_gameId_mismatch', index, expected: input.gameId, actual: stage?.gameId, dateISO: current.dateISO });
      return {
        daily: current,
        stageCompletedNow: false,
        circuitCompletedNow: false,
        alreadyCompleted: false,
      };
    }

    if (stage.completed) {
      logWarn('daily_stage_complete_skipped_already_completed', { dateISO: current.dateISO, stageIndex: index, gameId: input.gameId, reason: 'stage_already_completed' });
      return {
        daily: current,
        stageCompletedNow: false,
        circuitCompletedNow: false,
        alreadyCompleted: true,
      };
    }

    const nextStages = current.stages.map((entry, stageIndex) =>
      stageIndex === index
        ? {
            ...entry,
            completed: true,
            difficulty: normalizeDifficulty(input.difficulty, entry.difficulty),
            startedAtISO: entry.startedAtISO ?? nowISO(),
            completedAtISO: nowISO(),
            result: normalizeResult(input.result),
          }
        : entry,
    ) as [DailyStage, DailyStage, DailyStage];

    const allCompleted = nextStages.every((entry) => entry.completed);
    const next: DailyState = {
      ...current,
      stages: nextStages,
      status: allCompleted ? 'completed' : 'in_progress',
      completed: allCompleted,
      currentStageIndex: allCompleted ? 3 : getCurrentStageIndex(nextStages),
      startedAtISO: current.startedAtISO ?? nowISO(),
      completedAtISO: allCompleted ? current.completedAtISO ?? nowISO() : undefined,
    };

    await setItem(STORAGE_KEYS.daily, JSON.stringify(next));

    logEvent('daily_stage_completed', { dateISO: current.dateISO, stageIndex: index, gameId: input.gameId, difficulty: input.difficulty });

    if (allCompleted) {
      logEvent('daily_circuit_completed', { dateISO: current.dateISO });
      const marked = await markDailyCompletedInternal();
      return {
        daily: marked,
        stageCompletedNow: true,
        circuitCompletedNow: true,
        alreadyCompleted: false,
      };
    }

    return {
      daily: next,
      stageCompletedNow: true,
      circuitCompletedNow: false,
      alreadyCompleted: false,
    };
  });
}

export function getDailyProgress(daily: DailyState): { completedStages: number; totalStages: number } {
  return {
    completedStages: daily.stages.filter((stage) => stage.completed).length,
    totalStages: daily.stages.length,
  };
}

export async function markDailyStageStarted(input: { stageIndex?: number; gameId: GameId }): Promise<DailyState> {
  return runDailyMutation(async () => {
    const current = await ensureDailyToday();
    if (current.completed) return current;

    const index = typeof input.stageIndex === 'number'
      ? Math.max(0, Math.min(2, Math.floor(input.stageIndex)))
      : current.currentStageIndex;

    const stage = current.stages[index];
    if (!stage || stage.gameId !== input.gameId || stage.completed) {
      return current;
    }

    if (stage.startedAtISO && current.startedAtISO && current.status === 'in_progress') {
      return current;
    }

    const nextStages = current.stages.map((entry, stageIndex) =>
      stageIndex === index
        ? { ...entry, startedAtISO: entry.startedAtISO ?? nowISO() }
        : entry,
    ) as [DailyStage, DailyStage, DailyStage];

    const next: DailyState = {
      ...current,
      stages: nextStages,
      status: 'in_progress',
      startedAtISO: current.startedAtISO ?? nowISO(),
    };

    await setItem(STORAGE_KEYS.daily, JSON.stringify(next));
    logEvent('daily_stage_started', { dateISO: next.lastDailyDateISO, stageIndex: index, gameId: input.gameId });
    return next;
  });
}

export async function claimDailyReward(): Promise<{ daily: DailyState; alreadyClaimed: boolean }> {
  return runDailyMutation(async () => {
    const daily = await ensureDailyToday();

    if (!daily.completed) {
      return { daily, alreadyClaimed: false };
    }

    if (daily.rewardClaimed) {
      logWarn('daily_reward_claim_skipped_already_claimed', { dateISO: daily.lastDailyDateISO });
      return { daily, alreadyClaimed: true };
    }

    const claimed: DailyState = { ...daily, rewardClaimed: true, claimedRewardAtISO: nowISO() };
    await setItem(STORAGE_KEYS.daily, JSON.stringify(claimed));
    logEvent('daily_reward_claimed', { dateISO: daily.lastDailyDateISO });
    return { daily: claimed, alreadyClaimed: false };
  });
}

export async function resetDaily() {
  await runDailyMutation(async () => {
    await deleteItem(STORAGE_KEYS.daily);
  });
}