module.exports = {
  root: true,
  extends: '@react-native',
  ignorePatterns: ['android/app/build/**'],
  overrides: [
    {
      files: ['jest.setup.js', '__tests__/**/*.[jt]s?(x)'],
      env: {
        jest: true,
      },
    },
  ],
};
