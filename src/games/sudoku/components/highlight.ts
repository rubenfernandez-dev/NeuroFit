import { AppTheme } from '../../../shared/theme/theme';

type HighlightInput = {
  row: number;
  col: number;
  selectedIndex: number;
  selectedValue: number;
  cellValue: number;
};

export type CellHighlightState = {
  selected: boolean;
  rowOrCol: boolean;
  box: boolean;
  valueMatch: boolean;
  completionPulse: boolean;
};

export function getCellHighlightState({ row, col, selectedIndex, selectedValue, cellValue }: HighlightInput): CellHighlightState {
  const selectedRow = Math.floor(selectedIndex / 9);
  const selectedCol = selectedIndex % 9;

  return {
    selected: selectedIndex === row * 9 + col,
    rowOrCol: row === selectedRow || col === selectedCol,
    box: Math.floor(row / 3) === Math.floor(selectedRow / 3) && Math.floor(col / 3) === Math.floor(selectedCol / 3),
    valueMatch: selectedValue !== 0 && cellValue === selectedValue,
    completionPulse: false,
  };
}

export function getCellBackgroundColor(theme: AppTheme, state: CellHighlightState, error: boolean): string {
  if (error) return theme.colors.danger;
  if (state.completionPulse) return theme.mode === 'dark' ? 'rgba(74,222,128,0.34)' : 'rgba(34,197,94,0.26)';
  if (state.selected) return theme.mode === 'dark' ? '#4338CA' : '#C7D2FE';
  if (state.valueMatch) return theme.mode === 'dark' ? 'rgba(129,140,248,0.32)' : 'rgba(79,70,229,0.18)';
  if (state.rowOrCol || state.box) return theme.mode === 'dark' ? 'rgba(148,163,184,0.16)' : 'rgba(15,23,42,0.06)';
  return theme.colors.surface;
}
