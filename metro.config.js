const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Add .lottie extension so DotLottie files are treated as static assets
config.resolver.assetExts.push('lottie');

module.exports = config;
