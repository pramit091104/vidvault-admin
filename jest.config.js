export default {
  preset: 'ts-jest',
  testEnvironment: 'jest-environment-jsdom',
  setupFilesAfterEnv: ['<rootDir>/src/test/setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testMatch: [
    '<rootDir>/src/**/*.test.{js,jsx,ts,tsx}',
  ],
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!src/**/*.d.ts',
    '!src/test/**/*',
    '!src/database/**/*',
  ],
  extensionsToTreatAsEsm: ['.ts', '.tsx'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      useESM: true,
      tsconfig: {
        module: 'ES2020',
        target: 'ES2020',
        moduleResolution: 'node'
      }
    }]
  },
  transformIgnorePatterns: [
    'node_modules/(?!(uuid|fast-check)/)'
  ],
  testEnvironment: 'jsdom',
  globals: {
    'import.meta': {
      env: {
        VITE_RAZORPAY_KEY_ID: 'test_key_id'
      }
    }
  },
  // Property-based testing configuration
  testTimeout: 30000, // Increased timeout for property tests
  maxWorkers: '50%', // Limit workers for property tests
};