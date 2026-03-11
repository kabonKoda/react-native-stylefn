const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');
const { getConfig } = require('react-native-builder-bob/metro-config');
const { withStyleFn } = require('../metro-config');

const root = path.resolve(__dirname, '..');

const baseConfig = getDefaultConfig(__dirname);
const bobConfig = getConfig(baseConfig, {
  root,
  project: __dirname,
});

module.exports = withStyleFn(bobConfig, {
  input: './global.css',
  config: '../rn-stylefn.config.js',
  // inlineRem: 16, // Base pixel value for rem→px conversion (default 16, so 1rem = 16px)
});
