import PuppeteerArgs, { ValidPuppeteerArgs } from '@args/puppeteer-args';

import CredentialsPrompter from '@credentials-prompters/credentials-prompter';

import UsernamePasswordCredentials from '@interfaces/username-password-credentials';
import ValidUsernamePasswordCredentials from '@interfaces/valid-username-password-credentials';

export default class PuppeteerArgsValidator {
    constructor(
        private readonly credentialsPrompter: CredentialsPrompter
    ) {}

    public async validate(puppeteerArgs: PuppeteerArgs) {
        const credentials = await this.requestCredentialsIfMissing(puppeteerArgs);
        return <ValidPuppeteerArgs> {
            ...puppeteerArgs,
            ...credentials
        };
    }

    private async requestCredentialsIfMissing(args: PuppeteerArgs): Promise<Partial<PuppeteerArgs>> {
        const incomingCredentials: UsernamePasswordCredentials = {
            username: args.username,
            password: args.password
        };

        if(incomingCredentials.username
           && incomingCredentials.password) {
            const credentials: ValidUsernamePasswordCredentials = {
                username: incomingCredentials.username,
                password: incomingCredentials.password
            };

            return credentials;
        }

        return this.promptCredentials(args);
    }

    private async promptCredentials(args: PuppeteerArgs) {
        const incomingCredentials: UsernamePasswordCredentials = {
            username: args.username,
            password: args.password
        };

        return this.credentialsPrompter.prompt(incomingCredentials);
    }
}
