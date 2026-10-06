/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/tests'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  transform: { '^.+\\.tsx?$': ['ts-jest', { isolatedModules: true, diagnostics: false, tsconfig: { jsx: 'react-jsx', module: 'commonjs', esModuleInterop: true, target: 'ES2020', moduleResolution: 'node10', ignoreDeprecations: '6.0' } }] },
  moduleNameMapper: {
    '^@/lib/env$': '<rootDir>/tests/mocks/env.ts',
    '^@/(.*)$': '<rootDir>/src/$1',
    '\\.(css)$': 'identity-obj-proxy',
    '^react-markdown$': '<rootDir>/tests/mocks/markdown.tsx',
    '^remark-gfm$': '<rootDir>/tests/mocks/empty.ts',
  },
  testTimeout: 15000,
};
