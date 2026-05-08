const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Add .hdr files as assets so they can be required/imported
config.resolver.assetExts.push('hdr', 'glb', 'gltf', 'png', 'jpg');

// Ensure proper source roots for Expo Router
config.projectRoot = __dirname;
config.watchFolders = [__dirname];

module.exports = config;
