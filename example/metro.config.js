const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');
const { getConfig } = require('react-native-builder-bob/metro-config');

const root = path.resolve(__dirname, '..');

const baseConfig = getDefaultConfig(__dirname);

module.exports = getConfig(baseConfig, {
  root,
  project: __dirname,
});
