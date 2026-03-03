import * as SecureStore from 'expo-secure-store';

const SECURE_STORE_KEY_REGEX = /^[A-Za-z0-9._-]+$/;

function shortStackTrace(): string {
  const stack = new Error().stack ?? '';
  return stack
    .split('\n')
    .slice(2, 7)
    .join('\n');
}

function assertKey(key: string) {
  const ok = typeof key === 'string' && key.length > 0 && SECURE_STORE_KEY_REGEX.test(key);
  if (!ok) {
    const info = `Invalid SecureStore key: ${String(key)} (typeof ${typeof key})\n${shortStackTrace()}`;
    console.error(info);
    throw new Error(info);
  }
}

export async function getItem(key: string) {
  assertKey(key);
  return SecureStore.getItemAsync(key);
}

export async function setItem(key: string, value: string) {
  assertKey(key);
  return SecureStore.setItemAsync(key, value);
}

export async function deleteItem(key: string) {
  assertKey(key);
  return SecureStore.deleteItemAsync(key);
}
