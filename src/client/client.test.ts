import Client from './client';
import Credentials, { INVALID_CREDENTIALS } from './credentials';

const testSuiteFor = describe.each(global.availableBrowsers);
testSuiteFor('Client', ({ name: browserName }) => {
    it('Should successfully init and tear down', async () => {
        const client = new Client();

        expect(async () => await client.init(browserName)).not.toThrow();
        expect(async () => await client.end()).not.toThrow();
    });

    it('Should not be logged in after providing incorrect credentials', async () => {
        const client = new Client();

        await client.init(browserName);
        await client.logIn(INVALID_CREDENTIALS);
        const clientLoggedIn = client.loggedIn;
        await client.end();

        expect(clientLoggedIn).toBeFalsy();
    });

    it('Should report an error after providing incorrect credentials', async () => {
        const client = new Client();

        const loginFailureEvent = jest.fn();
        client.on('userError', loginFailureEvent);

        await client.init(browserName);
        await client.logIn(INVALID_CREDENTIALS);
        await client.end();

        expect(loginFailureEvent).toBeCalledTimes(1);
    });

    // Because there's no guarantee whether we see the bookmarks page upon
    // successful login, we just check if we are no longer on the login page.
    it('Should not still be at login after providing correct credentials', async () => {
        const {
            FTB_TWITTER_USERNAME: validUsername,
            FTB_TWITTER_PASSWORD: validPassword,
        } = process.env;

        if(!validUsername || !validPassword) {
            const errorMessage = [
                'Please provide valid Twitter credentials to test with to run this test.',
                'You can set credentials in the .env file under FTB_TWITTER_USERNAME and FTB_TWITTER_PASSWORD.'
            ].join('\r\n');

            throw new Error(errorMessage);
        }
        const validCredentials: Credentials = {
            username: validUsername,
            password: validPassword,
        }

        const client = new Client();
        await client.init(browserName);
        await client.logIn(validCredentials);
        const clientLoggedIn = client.loggedIn;
        await client.end();

        expect(clientLoggedIn).toBeTruthy();
    });
});
