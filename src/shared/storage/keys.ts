export const STORAGE_KEYS = {
  profile: 'neurofit.profile',
  // Legacy key retained for backward-compatible reset/migration flows.
  leaderboard: 'neurofit.leaderboard',
  // Legacy key retained for backward-compatible seed migrations.
  deviceSeed: 'neurofit.deviceSeed',
  stats: 'neurofit.stats',
  daily: 'neurofit.daily',
  notifications: 'neurofit.notifications',
  feedback: 'neurofit.feedback',
  sudokuState: 'neurofit.sudoku.state',
  memoryState: 'neurofit.memory.state',
  mentalMathState: 'neurofit.mentalmath.state',
  speedMatchState: 'neurofit.speedmatch.state',
  patternMemoryState: 'neurofit.patternmemory.state',
  focusGridState: 'neurofit.focusgrid.state',
  numberMatchState: 'neurofit.numbermatch.state',
  dailyUserSeed: 'neurofit.daily.userSeed',
  lastDailyCircuit: 'neurofit.daily.lastCircuit',
} as const;