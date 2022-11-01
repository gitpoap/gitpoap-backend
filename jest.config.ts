/*
 * For a detailed explanation regarding each configuration property and type check, visit:
 * https://jestjs.io/docs/configuration
 */

export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  // Automatically clear mock calls, instances, contexts and results before every test
  clearMocks: true,
  roots: ['<rootDir>/__tests__'],
  modulePathIgnorePatterns: ['<rootDir>/dist/', '<rootDir>/aws/', '/node_modules/'],
  setupFiles: ['./__tests__/setup.ts', 'dotenv/config'],
};
