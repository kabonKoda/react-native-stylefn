const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');
const { getConfig } = require('react-native-builder-bob/metro-config');
const { withStyleFn } = require('react-native-stylefn/metro-config');

const root = path.resolve(__dirname, '..');

const baseConfig = getDefaultConfig(__dirname);
const bobConfig = getConfig(baseConfig, {
  root,
  project: __dirname,
});

module.exports = withStyleFn(bobConfig, {
  input: './global.css',
});
