module.exports = function (api) {
  api.cache.using(() => process.env.NODE_ENV);
  const isProduction = process.env.NODE_ENV === 'production';
  return {
    presets: ['babel-preset-expo'],
    plugins: isProduction
      ? [
          // Strip console.log/info/debug from production bundles; keep error/warn
          // so the logger façade (which routes those to Sentry) still emits.
          ['transform-remove-console', { exclude: ['error', 'warn'] }],
        ]
      : [],
  };
};
