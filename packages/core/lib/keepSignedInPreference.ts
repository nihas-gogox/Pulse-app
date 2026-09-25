/**
 * "Keep me signed in" preference — persisted so we can sign out on app background when unchecked.
 * Key: @pulse/keep-signed-in; value: "true" | "false". Default (missing) = true (keep session).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@pulse/keep-signed-in';

export async function getKeepSignedIn(): Promise<boolean> {
  try {
    const value = await AsyncStorage.getItem(KEY);
    if (value === 'false') return false;
    return true; // "true" or missing => keep signed in
  } catch {
    return true;
  }
}

export async function setKeepSignedIn(keep: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, keep ? 'true' : 'false');
  } catch {
    // Ignore storage errors
  }
}
