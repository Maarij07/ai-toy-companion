const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {
  resolver: {
    assetExts: ['bin', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'], // Add support for binary files and image formats
    sourceExts: ['js', 'jsx', 'json', 'ts', 'tsx', 'cjs', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'],
    unstable_enableSymlinks: false,
  },
  transformer: {
    unstable_allowRequireContext: true,
    minifierConfig: {
      keep_fnames: true, // Preserve function names for better debugging
    },
  },
  // Add resolver for handling URL protocol issues
  server: {
    enhanceMiddleware: (middleware) => {
      // Workaround for protocol getter/setter issue
      if (global && !global.URL) {
        try {
          global.URL = require('url').URL;
        } catch (e) {
          console.warn('Could not set global.URL:', e);
        }
      }
      return middleware;
    }
  }
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
