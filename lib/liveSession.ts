import AsyncStorage from '@react-native-async-storage/async-storage';

// A workout / study session in progress survives the app being closed:
// the screen saves a snapshot on every change and restores it on open.
// Timers are stored as start timestamps, so the time keeps counting while closed.
export type LiveKey = 'gym:live' | 'learn:live';

export async function saveLive<T>(key: LiveKey, snap: T | null): Promise<void> {
  try {
    if (snap === null) await AsyncStorage.removeItem(key);
    else await AsyncStorage.setItem(key, JSON.stringify({ ...snap, savedAt: Date.now() }));
  } catch {}
}

export async function loadLive<T>(key: LiveKey, maxAgeH = 18): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    const snap = JSON.parse(raw);
    // a session left open for most of a day was forgotten, not paused
    if (!snap?.savedAt || Date.now() - snap.savedAt > maxAgeH * 3600_000) {
      await AsyncStorage.removeItem(key);
      return null;
    }
    return snap as T;
  } catch {
    return null;
  }
}

/** Logout: drop any half-finished session of the previous account. */
export const clearLive = () => AsyncStorage.multiRemove(['gym:live', 'learn:live']).catch(() => {});
