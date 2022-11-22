/*
 * For a detailed explanation regarding each configuration property, visit:
 * https://jestjs.io/docs/configuration
 */

process.env.NODE_ENV = 'test';

/** @type {import('jest').Config} */
const config = {
  preset: 'ts-jest',
  clearMocks: true,
  injectGlobals: true,
  testEnvironment: 'node',
  rootDir: './src',
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
};

module.exports = config;
