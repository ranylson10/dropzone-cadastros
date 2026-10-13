const { getDefaultConfig } = require("expo/metro-config");
const path = require("node:path");

const config = getDefaultConfig(__dirname);
// app is installed independently from the root web workspace. Watch the shared
// pure operation contracts explicitly; Metro SDK 54 cannot resolve them otherwise.
config.watchFolders = [...new Set([
  ...(config.watchFolders || []),
  path.resolve(__dirname, "../backend/src/campeonatos"),
  path.resolve(__dirname, "../backend/src/shared"),
])];

module.exports = config;
