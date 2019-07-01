module.exports = {
    roots: [
        '<rootDir>/src'
    ],

    transform: {
        '^.+\\.ts$': 'ts-jest'
    },

    setupFiles: [
        '<rootDir>/src/config/test-setup.ts'
    ]
};
