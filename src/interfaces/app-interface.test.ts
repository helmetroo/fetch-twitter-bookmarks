// Unit tests for the app interface
// Not concerned with running a tweet extraction task and getting results from it.

import testContainer from '../config/test-ioc-container';

import AppInterface from './app-interface';

import TYPE_TOKENS from '../tokens/all';
const {
    AppInterface: AppInterfaceToken
} = TYPE_TOKENS;

const appInterface =
    testContainer.get<AppInterface>(AppInterfaceToken);

test('errors when silent is set and fileName is not provided', () => {
    const args = [
        '--silent',
    ];

    expect(appInterface.run(args)).rejects;
});

test('proceeds when silent is set and fileName is provided', () => {
    const args = [
        '--silent',
        '--fileName="tweets.json"'
    ];

    expect(appInterface.run(args)).resolves;
});

test('errors when maxLimit is provided as a string', () => {
    const args = [
        '--maxLimit="abc"',
    ];

    expect(appInterface.run(args)).rejects;
});

test('errors when maxLimit is provided as a decimal', () => {
    const args = [
        '--maxLimit=120.01',
    ];

    expect(appInterface.run(args)).rejects;
});
