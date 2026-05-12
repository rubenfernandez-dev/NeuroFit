import { Difficulty } from '../../types';

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export type MentalMathSessionConfig = {
  initialTimeSec: number;
  maxTimeSec: number;
  bonusOnCorrectSec: number;
  maxErrors: number;
  minCorrectToWin: number;
  minAccuracyPctToWin: number;
};

/**
 * BONUS DE TIEMPO POR DIFICULTAD - OPCIONES PROPUESTAS
 * 
 * ACTUAL (valores en línea abajo):
 * principiante: 3s | avanzado: 3s | maestro: 4s | gran_maestro: 4s
 * 
 * OPCIÓN A - CONSERVADORA (reduce presión principalmente en niveles altos):
 * principiante: 2s | avanzado: 2s | maestro: 3s | gran_maestro: 3s
 * Rationale: Mantiene el juego desafiante, especialmente para principiantes.
 * 
 * OPCIÓN B - EQUILIBRADA (reducción suave según dificultad):
 * principiante: 3s | avanzado: 3s | maestro: 3s | gran_maestro: 4s
 * Rationale: Mantiene consistencia, recompensa máximo nivel ligeramente.
 * 
 * OPCIÓN C - EXIGENTE (presión mayor, rewards en niveles altos):
 * principiante: 2s | avanzado: 2s | maestro: 4s | gran_maestro: 5s
 * Rationale: Niveles bajos son más desafiantes, expertos reciben recompensa mayor.
 * 
 * ⚠️  IMPORTANTE: Cambiar solo los valores `bonusOnCorrectSec` abajo.
 * Mantén el resto de propiedades igual a menos que encuentres desequilibrios obvios.
 * 
 * Para aplicar, descomenta la opción que prefieras y comenta la actual.
 */
const CONFIG_BY_DIFFICULTY: Record<Difficulty, MentalMathSessionConfig> = {
  // === CURRENT (default) ===
  principiante: { initialTimeSec: 60, maxTimeSec: 110, bonusOnCorrectSec: 1.5, maxErrors: 5, minCorrectToWin: 7, minAccuracyPctToWin: 50 },
  avanzado: { initialTimeSec: 60, maxTimeSec: 110, bonusOnCorrectSec: 1.5, maxErrors: 5, minCorrectToWin: 8, minAccuracyPctToWin: 55 },
  experto: { initialTimeSec: 62, maxTimeSec: 112, bonusOnCorrectSec: 1.5, maxErrors: 5, minCorrectToWin: 9, minAccuracyPctToWin: 58 },
  maestro: { initialTimeSec: 68, maxTimeSec: 118, bonusOnCorrectSec: 4, maxErrors: 5, minCorrectToWin: 10, minAccuracyPctToWin: 62 },
  gran_maestro: { initialTimeSec: 72, maxTimeSec: 124, bonusOnCorrectSec: 4, maxErrors: 5, minCorrectToWin: 11, minAccuracyPctToWin: 65 },

  /* OPCIÓN A - CONSERVADORA (uncomment below to use)
  principiante: { initialTimeSec: 60, maxTimeSec: 110, bonusOnCorrectSec: 2, maxErrors: 8, minCorrectToWin: 7, minAccuracyPctToWin: 50 },
  avanzado: { initialTimeSec: 60, maxTimeSec: 110, bonusOnCorrectSec: 2, maxErrors: 7, minCorrectToWin: 8, minAccuracyPctToWin: 55 },
  experto: { initialTimeSec: 62, maxTimeSec: 112, bonusOnCorrectSec: 2, maxErrors: 6, minCorrectToWin: 9, minAccuracyPctToWin: 58 },
  maestro: { initialTimeSec: 68, maxTimeSec: 118, bonusOnCorrectSec: 3, maxErrors: 5, minCorrectToWin: 10, minAccuracyPctToWin: 62 },
  gran_maestro: { initialTimeSec: 72, maxTimeSec: 124, bonusOnCorrectSec: 3, maxErrors: 5, minCorrectToWin: 11, minAccuracyPctToWin: 65 },
  */

  /* OPCIÓN B - EQUILIBRADA (uncomment below to use)
  principiante: { initialTimeSec: 60, maxTimeSec: 110, bonusOnCorrectSec: 3, maxErrors: 8, minCorrectToWin: 7, minAccuracyPctToWin: 50 },
  avanzado: { initialTimeSec: 60, maxTimeSec: 110, bonusOnCorrectSec: 3, maxErrors: 7, minCorrectToWin: 8, minAccuracyPctToWin: 55 },
  experto: { initialTimeSec: 62, maxTimeSec: 112, bonusOnCorrectSec: 3, maxErrors: 6, minCorrectToWin: 9, minAccuracyPctToWin: 58 },
  maestro: { initialTimeSec: 68, maxTimeSec: 118, bonusOnCorrectSec: 3, maxErrors: 5, minCorrectToWin: 10, minAccuracyPctToWin: 62 },
  gran_maestro: { initialTimeSec: 72, maxTimeSec: 124, bonusOnCorrectSec: 4, maxErrors: 5, minCorrectToWin: 11, minAccuracyPctToWin: 65 },
  */

  /* OPCIÓN C - EXIGENTE (uncomment below to use)
  principiante: { initialTimeSec: 60, maxTimeSec: 110, bonusOnCorrectSec: 2, maxErrors: 8, minCorrectToWin: 7, minAccuracyPctToWin: 50 },
  avanzado: { initialTimeSec: 60, maxTimeSec: 110, bonusOnCorrectSec: 2, maxErrors: 7, minCorrectToWin: 8, minAccuracyPctToWin: 55 },
  experto: { initialTimeSec: 62, maxTimeSec: 112, bonusOnCorrectSec: 2, maxErrors: 6, minCorrectToWin: 9, minAccuracyPctToWin: 58 },
  maestro: { initialTimeSec: 68, maxTimeSec: 118, bonusOnCorrectSec: 4, maxErrors: 5, minCorrectToWin: 10, minAccuracyPctToWin: 62 },
  gran_maestro: { initialTimeSec: 72, maxTimeSec: 124, bonusOnCorrectSec: 5, maxErrors: 5, minCorrectToWin: 11, minAccuracyPctToWin: 65 },
  */
};

export function getMentalMathSessionConfig(difficulty: Difficulty): MentalMathSessionConfig {
  return CONFIG_BY_DIFFICULTY[difficulty];
}

export function computeMentalMathRewardScore(input: {
  correct: number;
  wrong: number;
  elapsedSec: number;
  difficulty: Difficulty;
}): number {
  const config = getMentalMathSessionConfig(input.difficulty);
  const attempts = input.correct + input.wrong;
  const accuracy = attempts > 0 ? (input.correct / attempts) * 100 : 0;
  const pace = input.correct / Math.max(1, input.elapsedSec / 60);
  const paceTarget = config.minCorrectToWin * 1.05;
  const paceScore = clamp((pace / paceTarget) * 100, 0, 100);
  const completionScore = clamp((input.correct / config.minCorrectToWin) * 100, 0, 100);
  const mistakeBudgetScore = clamp(((config.maxErrors - input.wrong) / Math.max(1, config.maxErrors)) * 100, 0, 100);

  const weighted = accuracy * 0.4 + completionScore * 0.3 + paceScore * 0.2 + mistakeBudgetScore * 0.1;
  return clamp(Math.round(weighted), 0, 100);
}

export function evaluateMentalMathWin(input: {
  correct: number;
  wrong: number;
  difficulty: Difficulty;
}): boolean {
  const config = getMentalMathSessionConfig(input.difficulty);
  if (input.wrong > config.maxErrors) return false;

  const attempts = input.correct + input.wrong;
  const accuracy = attempts > 0 ? (input.correct / attempts) * 100 : 0;
  return input.correct >= config.minCorrectToWin && accuracy >= config.minAccuracyPctToWin;
}
