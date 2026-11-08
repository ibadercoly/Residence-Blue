module.exports = {
  preset: 'ts-jest/presets/default-esm',
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        useESM: true,
        diagnostics: false,
        tsconfig: {
          module: 'ESNext',
        },
      },
    ],
  },
  moduleNameMapper: {
    '^@residence-blue/shared$': '<rootDir>/../../../packages/shared/src/index.ts',
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  testEnvironment: 'node',
};
