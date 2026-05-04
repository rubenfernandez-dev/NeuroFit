export const NEURO_COIN_COSTS = {
  mentalMathExtraTime: 15,
  mentalMathSkipQuestion: 20,
  sudokuRecoverMistake: 20,
  focusGridRevealNext: 10,
  focusGridExtraTime: 15,
  patternMemoryRepeatSequence: 20,
} as const;

export type NeuroCoinCostKey = keyof typeof NEURO_COIN_COSTS;
