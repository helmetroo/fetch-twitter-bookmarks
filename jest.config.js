module.exports = {
    roots: [
        '<rootDir>/src'
    ],

    setupFiles: [
        'dotenv/config',
    ],

    testEnvironment: '<rootDir>/src/config/setup-tests.ts',

    transform: {
        '^.+\\.ts$': 'ts-jest'
    }
};
