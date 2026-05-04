export const NEURO_COIN_NAME = 'NeuroCoins';
export const NEURO_COIN_ICON = '🪙';
export const NEURO_COIN_SHORT_NAME = 'NC';

function toSafeAmount(amount: number): number {
  if (!Number.isFinite(amount)) return 0;
  return Math.max(0, Math.floor(amount));
}

export function formatNeuroCoins(amount: number): string {
  const safeAmount = toSafeAmount(amount);
  return `${NEURO_COIN_ICON} ${safeAmount} ${NEURO_COIN_NAME}`;
}

export function formatNeuroCoinsCompact(amount: number): string {
  const safeAmount = toSafeAmount(amount);
  return `${NEURO_COIN_ICON} ${safeAmount}`;
}

export function formatNeuroCoinReward(amount: number): string {
  const safeAmount = toSafeAmount(amount);
  return `+${safeAmount} ${NEURO_COIN_NAME}`;
}

export function formatNeuroCoinRewardCompact(amount: number): string {
  const safeAmount = toSafeAmount(amount);
  return `+${safeAmount} ${NEURO_COIN_ICON}`;
}

export function formatNeuroCoinCost(amount: number): string {
  const safeAmount = toSafeAmount(amount);
  return `${safeAmount} ${NEURO_COIN_NAME}`;
}

export function formatNeuroCoinCostCompact(amount: number): string {
  const safeAmount = toSafeAmount(amount);
  return `${safeAmount} ${NEURO_COIN_ICON}`;
}

export function toSafeNeuroCoinAmount(amount: number): number {
  return toSafeAmount(amount);
}
