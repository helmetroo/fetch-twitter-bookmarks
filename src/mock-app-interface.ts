import CommandLineArgs from './interfaces/command-line-args';
import UsernamePasswordCredentials from './interfaces/username-password-credentials';
import ValidUsernamePasswordCredentials from './interfaces/valid-username-password-credentials';
import Maybe from './interfaces/maybe';
import AppInterface from './interfaces/app-interface';

export default class MockAppInterface extends AppInterface {
    public async run(stringArgs: string[]) {
        this.runExtractionTask(stringArgs);
    }

    protected async requestCredentials(cmdLineArgs: CommandLineArgs) {
        const shortestInvalidUsername = MockAppInterface.createFakeCredential(51);
        const shortestPassword = MockAppInterface.createFakeCredential(1);

        const fakeCredentials: ValidUsernamePasswordCredentials = {
            username: shortestInvalidUsername,
            password: shortestPassword
        };

        return fakeCredentials;
    }

    private static createFakeCredential(length: number) {
        let result = '';
        const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        const charactersLength = characters.length;
        for(let i = 0; i < length; i++) {
            result += characters.charAt(Math.random() * charactersLength);
        }

        return result;
    }

    protected onTaskComplete() {}
    protected handleSuccess() {}
    protected handleError(err: Error): never {
        throw err;
    }
}
