// Pulse Driver — Metro config (driver extraction, Phase 3).
// Monorepo: watch the repo root (packages/*, root assets/polyfills) and resolve from
// this app's node_modules first, then the root's. The resolver/transformer/serializer
// customizations below are copied from the root metro.config.js — they are bundle
// correctness fixes (Hermes crypto, moti/framer-motion, svg, tslib, webview), not
// main-app features. The root's /oms and /admin dev proxies are main-app only.
const path = require('path');
const os = require('os');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '..', '..');
require(path.join(workspaceRoot, 'scripts/expo-env'));

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];

const cpuCount = os.cpus().length;
config.maxWorkers = Math.max(1, Number(process.env.METRO_MAX_WORKERS) || Math.min(4, Math.max(2, cpuCount - 1)));

const escapeRe = (p) => p.replace(/[/\\]/g, '[/\\\\]');
const extraBlockList = [
  /\.git\//,
  /\.expo\//,
  /\.metro-cache\//,
  new RegExp(`${escapeRe(path.resolve(workspaceRoot, 'dist'))}[/\\\\]`),
  new RegExp(`${escapeRe(path.resolve(projectRoot, 'dist'))}[/\\\\]`),
  /\/web-build\//,
  /\/playwright-report\//,
  /\/test-results\//,
  /\/coverage\//,
  /\/supabase\/migrations\//,
  /\/supabase\/functions\//,
  /\/supabase\/\.temp\//,
  /\/data-analytics\//,
  /\/\.claude\//,
  /\/\.cursor\//,
  /\/docs\//,
  /\/scripts\/sql\//,
  /\/dist-test-bundle\//,
  /\/android\/build\//,
  /\/ios\/build\//,
  new RegExp(`${escapeRe(path.resolve(workspaceRoot, 'oms'))}[/\\\\]`),
  new RegExp(`${escapeRe(path.resolve(workspaceRoot, 'analytics'))}[/\\\\]`),
];

const { transformer, resolver } = config;
const existingBlock = resolver.blockList;
const blockList = Array.isArray(existingBlock)
  ? [...existingBlock, ...extraBlockList]
  : existingBlock
    ? [existingBlock, ...extraBlockList]
    : extraBlockList;
const upstreamResolveRequest = resolver.resolveRequest;

const nodeModules = path.resolve(workspaceRoot, 'node_modules');
const framerMotionNativeShimPath = path.resolve(workspaceRoot, 'polyfills/framer-motion-native.js');
const runtimeKindPolyfillPath = path.resolve(workspaceRoot, 'polyfills/runtimeKind.js');
const cryptoPolyfillPath = path.resolve(workspaceRoot, 'polyfills/cryptoGetRandomValues.js');
const webChunkRecoveryPolyfillPath = path.resolve(workspaceRoot, 'polyfills/webChunkRecovery.js');
const metroRuntimePath = path.resolve(nodeModules, '@expo/metro-runtime/src/index.ts');
const motiFramerShimPath = path.resolve(nodeModules, 'moti/build/framer-motion-shim.js');
const isFramerMotionRequest = (moduleName) =>
  moduleName === 'framer-motion' || moduleName.startsWith('framer-motion/');
const isNativePlatform = (platform) =>
  platform == null || platform === 'ios' || platform === 'android' || platform === 'native';

config.transformer = {
  ...transformer,
  babelTransformerPath: require.resolve('react-native-svg-transformer/expo'),
  minifierConfig: { compress: { reduce_funcs: false } },
  getTransformOptions: async () => ({
    transform: { experimentalImportSupport: false, inlineRequires: false },
  }),
};

const upstreamGetModulesRunBeforeMainModule = config.serializer?.getModulesRunBeforeMainModule;
config.serializer = {
  ...config.serializer,
  getModulesRunBeforeMainModule: () => {
    const upstream = upstreamGetModulesRunBeforeMainModule?.() ?? [];
    return [cryptoPolyfillPath, runtimeKindPolyfillPath, webChunkRecoveryPolyfillPath, ...upstream];
  },
};

config.resolver = {
  ...resolver,
  blockList,
  nodeModulesPaths: [path.resolve(projectRoot, 'node_modules'), nodeModules],
  unstable_enablePackageExports: false,
  assetExts: resolver.assetExts.filter((ext) => ext !== 'svg'),
  sourceExts: [...resolver.sourceExts, 'svg'],
  resolveRequest(context, moduleName, platform) {
    if (moduleName === '@expo/metro-runtime') {
      return { filePath: metroRuntimePath, type: 'sourceFile' };
    }
    if (moduleName === '../framer-motion-shim' && context.originModulePath?.includes(`${path.sep}moti${path.sep}`)) {
      return { filePath: motiFramerShimPath, type: 'sourceFile' };
    }
    if (moduleName === 'tslib' || moduleName.endsWith('/tslib')) {
      return { filePath: path.resolve(nodeModules, 'tslib/tslib.js'), type: 'sourceFile' };
    }
    if (isNativePlatform(platform) && moduleName === 'react-native-webview') {
      return { filePath: path.resolve(nodeModules, 'react-native-webview/index.js'), type: 'sourceFile' };
    }
    if (isNativePlatform(platform) && isFramerMotionRequest(moduleName)) {
      return { filePath: framerMotionNativeShimPath, type: 'sourceFile' };
    }
    if (typeof upstreamResolveRequest === 'function') {
      return upstreamResolveRequest(context, moduleName, platform);
    }
    return context.resolveRequest(context, moduleName, platform);
  },
};

config.watcher = { ...config.watcher, healthCheck: { enabled: false } };

module.exports = config;
