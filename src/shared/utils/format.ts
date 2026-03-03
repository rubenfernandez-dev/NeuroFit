export function formatNumber(value: number): string {
  return new Intl.NumberFormat('es-ES').format(value);
}

export function optionalValue(value?: number | string): string {
  if (value === undefined || value === null) return '-';
  return String(value);
}