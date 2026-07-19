module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // Must be listed last — react-native-reanimated's Babel transform.
    plugins: ['react-native-reanimated/plugin'],
  };
};
