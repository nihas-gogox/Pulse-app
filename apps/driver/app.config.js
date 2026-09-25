// Pulse Driver — Expo config (driver extraction, Phase 3; docs/DRIVER_EXTRACTION_PLAN.md).
// Own native identity. Same Supabase project as the main app, so it reads the same
// repo-root .env. Permissions and plugins are copied from the root app.config.js.
const path = require('path');
const fs = require('fs');

const repoRoot = path.resolve(__dirname, '..', '..');
require(path.join(repoRoot, 'scripts/expo-env'));

const envPath = path.join(repoRoot, '.env');
const envLocalPath = path.join(repoRoot, '.env.local');
require('dotenv').config({ path: envPath, override: true, quiet: true });
if (fs.existsSync(envLocalPath)) {
  require('dotenv').config({ path: envLocalPath, override: true, quiet: true });
}

function parseEnvFile(filePath) {
  const out = {};
  if (!fs.existsSync(filePath)) return out;
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'")))
      val = val.slice(1, -1);
    if (key) out[key] = val;
  }
  return out;
}

// Same source-of-truth order as the root config: .env.local → .env → process.env (CI only).
const envVars = parseEnvFile(envPath);
const localVars = parseEnvFile(envLocalPath);
const isCI = process.env.CI === 'true';
const pick = (...keys) => {
  for (const k of keys) if (localVars[k]) return localVars[k];
  for (const k of keys) if (envVars[k]) return envVars[k];
  if (isCI) for (const k of keys) if (process.env[k]) return process.env[k];
  return '';
};
const supabaseUrl = pick('EXPO_PUBLIC_SUPABASE_URL', 'VITE_SUPABASE_URL');
const supabaseAnonKey = pick('EXPO_PUBLIC_SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY');
const geminiApiKey = pick('EXPO_PUBLIC_GEMINI_API_KEY', 'VITE_GEMINI_API_KEY');
if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('[pulse-driver] Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY in the repo-root .env');
}

const buildStamp =
  process.env.EXPO_PUBLIC_BUILD_ID ||
  process.env.COMMIT_REF ||
  process.env.BUILD_ID ||
  process.env.EAS_BUILD_ID ||
  process.env.VERCEL_GIT_COMMIT_SHA ||
  'dev';

// Web base path. '/driver' while the app is served at gogopulse.com/driver;
// domain mode (driver.gogopulse.com, plan Phase 5) builds with PULSE_DRIVER_BASE_URL=''.
const webBaseUrl = process.env.PULSE_DRIVER_BASE_URL ?? '/driver';

let sentryPluginAvailable = false;
try {
  require.resolve('@sentry/react-native/app.plugin');
  sentryPluginAvailable = true;
} catch (_) {}
const sentryPlugin =
  sentryPluginAvailable && process.env.SENTRY_ORG && process.env.SENTRY_PROJECT
    ? [['@sentry/react-native/expo', { organization: process.env.SENTRY_ORG, project: process.env.SENTRY_PROJECT }]]
    : [];

// Production (https Supabase URL): no cleartext on Android. Local dev (http): allow.
const useCleartextTraffic = typeof supabaseUrl === 'string' && supabaseUrl.startsWith('http://');

const rootAssets = '../../assets/images';

module.exports = {
  expo: {
    name: 'Pulse Driver',
    slug: 'pulse-driver',
    version: '1.0.0',
    orientation: 'portrait',
    icon: `${rootAssets}/icon.png`,
    scheme: 'pulsedriver',
    userInterfaceStyle: 'automatic',
    newArchEnabled: true,
    splash: {
      image: `${rootAssets}/splash-icon.png`,
      resizeMode: 'contain',
      backgroundColor: '#ffffff',
    },
    ios: {
      bundleIdentifier: 'com.gogopulse.driver',
      supportsTablet: true,
      infoPlist: {
        LSApplicationQueriesSchemes: ['whatsapp'],
        UIBackgroundModes: ['location'],
        NSLocationWhenInUseUsageDescription: 'Driver location is used for live trip tracking.',
        NSLocationAlwaysAndWhenInUseUsageDescription:
          'Location tracking continues during trips even when the app is in background.',
        NSLocationAlwaysUsageDescription: 'This app tracks driver location for logistics trip monitoring.',
        NSCameraUsageDescription:
          'Allow PULSE to use the camera for odometer photos, receipts, and document uploads.',
        NSPhotoLibraryUsageDescription:
          'Allow PULSE to access your photos for odometer photos, receipts, and document uploads.',
      },
    },
    android: {
      package: 'com.gogopulse.driver',
      adaptiveIcon: {
        foregroundImage: `${rootAssets}/adaptive-icon.png`,
        backgroundColor: '#000000',
      },
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
      permissions: ['android.permission.INTERNET'],
      softwareKeyboardLayoutMode: 'resize',
    },
    web: {
      bundler: 'metro',
      output: 'single',
      favicon: `${rootAssets}/favicon.png`,
      meta: {
        viewport: {
          content: 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover',
        },
      },
    },
    plugins: [
      [
        'expo-router',
        {
          asyncRoutes: { web: false, ios: false, android: false, default: 'development' },
        },
      ],
      '@maplibre/maplibre-react-native',
      [
        'expo-image-picker',
        {
          cameraPermission:
            'Allow PULSE to use the camera for odometer photos, receipts, and document uploads.',
          photosPermission:
            'Allow PULSE to access your photos for odometer photos, receipts, and document uploads.',
        },
      ],
      ['expo-build-properties', { android: { usesCleartextTraffic: useCleartextTraffic }, ios: {} }],
      ...sentryPlugin,
    ],
    experiments: {
      typedRoutes: true,
      baseUrl: webBaseUrl,
    },
    extra: {
      supabaseUrl,
      supabaseAnonKey,
      geminiApiKey,
      buildId: buildStamp,
      router: { notFound: false },
      // eas: { projectId } — set by `eas init` once the Pulse Driver EAS project exists (owner: TBD).
    },
  },
};
