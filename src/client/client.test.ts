import { LoginErrorType, PageManagerInitError, TwitterLoginError } from '../constants/error';
import Client from './client';
import Credentials, { INVALID_CREDENTIALS } from './credentials';

function assertTestCredentialsProvided() {
    const {
        FTB_TWITTER_USERNAME: validUsername,
        FTB_TWITTER_PASSWORD: validPassword,
    } = process.env;

    if(!validUsername || !validPassword) {
        const errorMessage = [
            'Please provide valid Twitter credentials to run this test.',
            'You can set credentials in the .env file under FTB_TWITTER_USERNAME and FTB_TWITTER_PASSWORD.'
        ].join('\r\n');

        throw new Error(errorMessage);
    }

    const validCredentials: Credentials = {
        username: validUsername,
        password: validPassword,
    };

    return validCredentials;
}

const testSuiteFor = describe.each(global.availableBrowsers);
testSuiteFor('Client', ({ name: browserName }) => {
    // TODO add test that can test for timeout errors

    it('Should be able to only init the DB, then tear down', async () => {
        const client = new Client();
        const dbConfig = {
            inMemory: true
        };

        expect(async () => {
            await client.setDb(dbConfig);
            await client.end();
        }).not.toThrow();
    });

    it('Should be able to only init the browser, then tear down', async () => {
        const client = new Client();

        expect(async () => {
            await client.initBrowser(browserName);
            await client.end();
        }).not.toThrow();
    });

    it('Should be able to only init DB and browser, then tear down', async () => {
        const client = new Client();
        const dbConfig = {
            inMemory: true
        };

        expect(async () => {
            await client.setDb(dbConfig);
            await client.initBrowser(browserName);
            await client.end();
        }).not.toThrow();
    });

    it('Should throw a login error after providing incorrect credentials', async () => {
        const client = new Client();

        await client.initBrowser(browserName);
        try {
            await client.logIn(INVALID_CREDENTIALS);
            fail(`Didn't throw an error after providing incorrect credentials.`);
        } catch(err) {
            const loginErr = <TwitterLoginError> err;
            expect(loginErr.type).toEqual(LoginErrorType.IncorrectCredentials);
        } finally {
            await client.end();
        }
    });

    it('Should throw an error if attempting to login before setting browser', async () => {
        const client = new Client();
        expect(async () => {
            // Credential validity doesn't matter
            await client.logIn(INVALID_CREDENTIALS);
        }).toThrowError(PageManagerInitError);

        await client.end();
    });
});
