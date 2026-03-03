const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Add .hdr files as assets so they can be required/imported
config.resolver.assetExts.push('hdr', 'glb', 'gltf', 'png', 'jpg');

module.exports = config;
