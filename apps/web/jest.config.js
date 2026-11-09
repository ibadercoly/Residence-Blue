module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/src/**/*.spec.ts'],
  moduleNameMapper: {
    '^@residence-blue/shared$': '<rootDir>/../../packages/shared/src/index.ts',
    '^@angular/core$': '<rootDir>/test/mocks/angular-core.mock.ts',
    '^@angular/common$': '<rootDir>/test/mocks/angular-common.mock.ts',
    '^@angular/router$': '<rootDir>/test/mocks/angular-router.mock.ts'
  },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        diagnostics: false
      }
    ]
  }
};
