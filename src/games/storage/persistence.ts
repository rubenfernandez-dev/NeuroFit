import { Difficulty, normalizeDifficulty } from '../types';
import { logWarning } from '../../shared/observability';

export function parseStoredObject(raw: string | null): Record<string, unknown> | null {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
  } catch (error) {
    logWarning('storage.game.parse_failed', {
      reason: error instanceof Error ? error.message : 'unknown_error',
    });
    return null;
  }
}

export function normalizeStoredDifficulty(value: unknown, fallback: Difficulty): Difficulty {
  return normalizeDifficulty(value, fallback);
}

export function normalizeNonNegativeInt(value: unknown, fallback = 0, max = Number.MAX_SAFE_INTEGER): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.max(0, Math.min(max, Math.floor(value)));
}

export function normalizeOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

export function normalizeOptionalBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

export function normalizeOptionalSeed(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  const normalized = Math.floor(value);
  return normalized >= 1 ? normalized : undefined;
}

export function normalizeIndexArray(value: unknown, maxExclusive: number): number[] {
  if (!Array.isArray(value) || maxExclusive <= 0) return [];

  const seen = new Set<number>();
  const result: number[] = [];

  for (const item of value) {
    if (typeof item !== 'number' || !Number.isInteger(item) || item < 0 || item >= maxExclusive) continue;
    if (seen.has(item)) continue;
    seen.add(item);
    result.push(item);
  }

  return result;
}