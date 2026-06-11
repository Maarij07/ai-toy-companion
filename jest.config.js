module.exports = {
  preset: 'react-native',
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': 'babel-jest',
    '^.+\\.(bmp|gif|jpg|jpeg|mp4|png|psd|svg|webp)$':
      '<rootDir>/node_modules/react-native/jest/assetFileTransformer.js',
  },
  transformIgnorePatterns: [
    'node_modules[\\\\/](?!((jest-)?react-native|@react-native|@react-native-community|@react-navigation|@expo|expo|@gluestack-ui|@gluestack-style|@legendapp|lucide-react-native|react-native-svg|react-native-vector-icons)[\\\\/])',
  ],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
};
