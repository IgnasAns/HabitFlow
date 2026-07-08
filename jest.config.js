/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
    testEnvironment: 'node',
    roots: ['<rootDir>/src'],
    testMatch: ['**/__tests__/**/*.test.ts'],
    transform: {
        '^.+\\.ts$': [
            'ts-jest',
            {
                // Override module to CommonJS so Jest's Node env can require the output.
                tsconfig: {
                    module: 'commonjs',
                    esModuleInterop: true,
                    isolatedModules: true,
                },
            },
        ],
    },
};
