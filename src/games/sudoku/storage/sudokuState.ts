import { STORAGE_KEYS } from '../../../shared/storage/keys';
import { SudokuPersistedState } from '../model/types';
import { deleteItem, getItem, setItem } from '../../../shared/storage/secureStore';

export async function getSudokuState(): Promise<SudokuPersistedState | null> {
  const raw = await getItem(STORAGE_KEYS.sudokuState);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SudokuPersistedState;
  } catch {
    return null;
  }
}

export async function saveSudokuState(state: SudokuPersistedState) {
  await setItem(STORAGE_KEYS.sudokuState, JSON.stringify(state));
}

export async function clearSudokuState() {
  await deleteItem(STORAGE_KEYS.sudokuState);
}