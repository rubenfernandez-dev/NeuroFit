export const STORAGE_KEYS = {
  profile: 'neurofit.profile',
  // TODO: Remove after confirming no reset/migration flow still expects this legacy key.
  leaderboard: 'neurofit.leaderboard',
  // TODO: Remove after confirming no persisted device seed migration is planned.
  deviceSeed: 'neurofit.deviceSeed',
  stats: 'neurofit.stats',
  daily: 'neurofit.daily',
  notifications: 'neurofit.notifications',
  sudokuState: 'neurofit.sudoku.state',
  memoryState: 'neurofit.memory.state',
  mentalMathState: 'neurofit.mentalmath.state',
  speedMatchState: 'neurofit.speedmatch.state',
  patternMemoryState: 'neurofit.patternmemory.state',
  focusGridState: 'neurofit.focusgrid.state',
} as const;