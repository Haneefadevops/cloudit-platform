module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  testEnvironment: 'node',
  roots: ['<rootDir>/test'],
  testMatch: ['**/*.spec.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json', isolatedModules: true }],
  },
  moduleNameMapper: {
    '^@cloudit/operations-agent-contracts$':
      '<rootDir>/../../packages/operations-agent-contracts/src/index.ts',
  },
};
