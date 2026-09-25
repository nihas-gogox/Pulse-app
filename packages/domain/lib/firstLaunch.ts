/**
 * First-launch flag — used to clear any lingering auth data after app reinstall.
 * Keychain (iOS) can persist after uninstall; on first launch we clear local auth
 * so we don't restore a stale session. See docs/AUTH_LIFECYCLE.md.
 */
import { supabase } from '@pulse/core/lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@pulse/first-launch-done';

/** Prevents React Strict Mode double-mount from running the clear twice in one boot. */
let firstLaunchClearDoneThisRuntime = false;

export async function isFirstLaunchDone(): Promise<boolean> {
  try {
    const value = await AsyncStorage.getItem(KEY);
    return value === 'true';
  } catch {
    return false;
  }
}

export async function setFirstLaunchDone(): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, 'true');
  } catch {
    // Ignore
  }
}

/**
 * One-time post-install local auth clear. Safe under Strict Mode (in-memory guard).
 */
export async function clearStaleAuthOnFirstLaunch(): Promise<void> {
  if (firstLaunchClearDoneThisRuntime) return;
  const done = await isFirstLaunchDone();
  if (done) return;
  firstLaunchClearDoneThisRuntime = true;
  try {
    await supabase().auth.signOut({ scope: 'local' });
  } catch {
    // Proceed — restore should still run
  }
  await setFirstLaunchDone();
}
