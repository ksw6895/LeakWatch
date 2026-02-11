module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended', 'prettier'],
  ignorePatterns: ['node_modules/', 'dist/', '.next/', '.turbo/', 'coverage/'],
  rules: {
    '@typescript-eslint/no-explicit-any': 'off'
  }
};
