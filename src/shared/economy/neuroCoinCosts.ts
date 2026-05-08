export const NEURO_COIN_COSTS = {
  // Mental Math
  mentalMathExtraTime5: 30,
  mentalMathExtraTime10: 50,
  mentalMathSkipQuestion: 60,

  // Sudoku
  sudokuRecoverMistake: 60,
  sudokuFillSelectedCell: 50,
  sudokuRandomHint: 40,

  // Focus Grid
  focusGridExtra3Seconds: 30,
  focusGridExtra6Seconds: 50,
  focusGridRevealNextBlink: 50,

  // Speed Match
  speedMatchExtraTime5: 40,
  speedMatchExtraTime10: 70,
  speedMatchRemoveSymbol: 70,

  // Memory (cartas)
  memoryRevealAll1s: 100,
  memoryRevealAllHalfSecond: 60,
  memoryRevealOnePair: 60,

  // Pattern Memory
  patternMemoryRepeatSequence: 40,
  patternMemoryRemoveButton: 70,

  // Number Match
  numberMatchSuggestMove: 40,
  numberMatchRestoreMistake: 50,
  numberMatchRemovePairFromSelected: 50,
  numberMatchAddLine: 8,

  // Compatibilidad con nombres previos
  mentalMathExtraTime: 30,
  focusGridRevealNext: 50,
  speedMatchExtraTime: 40,
  memoryRevealCards: 60,
} as const;

export type NeuroCoinCostKey = keyof typeof NEURO_COIN_COSTS;
