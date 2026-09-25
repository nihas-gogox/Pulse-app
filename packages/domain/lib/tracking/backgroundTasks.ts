/**
 * Background GPS task registration.
 *
 * CRITICAL: This file must be imported at the top of app/_layout.tsx BEFORE any
 * component mounts. TaskManager.defineTask called lazily (inside useEffect or a
 * component) silently fails on iOS.
 *
 * Requires: expo-task-manager (install separately — not bundled with expo-location)
 *   npx expo install expo-task-manager
 *
 * If expo-task-manager is not installed this file is a no-op and background GPS
 * tracking is disabled (foreground-only tracking still works).
 */

import type { LocationObject } from 'expo-location';
import { TrackingEngine } from './TrackingEngine';

export const BACKGROUND_GPS_TASK = 'BACKGROUND_GPS';

type TaskManagerBody<T = unknown> = {
  data: T;
  error: { message: string } | null;
};

// Conditionally import TaskManager so the app doesn't crash if the package is absent.
// expo-task-manager must be in package.json for background GPS to work on iOS/Android.
let _defined = false;

export function ensureBackgroundTaskRegistered(): void {
  if (_defined) return;
  _defined = true;

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- optional native module, guarded by try/catch
    const TaskManager = require('expo-task-manager') as {
      defineTask: <T>(name: string, handler: (body: TaskManagerBody<T>) => void) => void;
    };

    TaskManager.defineTask<{ locations: LocationObject[] }>(
      BACKGROUND_GPS_TASK,
      ({ data, error }) => {
        if (error) {
          console.warn('[BackgroundGPS] task error:', error.message);
          return;
        }
        if (!data?.locations) return;

        const engine = TrackingEngine.getInstance();
        for (const loc of data.locations) {
          engine.handleGpsReading(loc.coords, loc.timestamp);
        }
      },
    );
  } catch {
    // expo-task-manager not installed — background GPS disabled, foreground tracking works
  }
}

// Register immediately on module load (import side-effect)
ensureBackgroundTaskRegistered();
