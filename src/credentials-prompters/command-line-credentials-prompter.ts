import passwordPrompt from 'password-prompt';

import UsernamePasswordCredentials from '@interfaces/username-password-credentials';
import ValidUsernamePasswordCredentials from '@interfaces/valid-username-password-credentials';

import CredentialsPrompter from './credentials-prompter';

export default class CommandLineCredentialsPrompter extends CredentialsPrompter {
    public async prompt(currentCredentials: UsernamePasswordCredentials) {
        const {
            username: incomingUsername,
            password: incomingPassword
        } = currentCredentials;

        const finalUsername = (!incomingUsername)
            ? await CommandLineCredentialsPrompter.promptCredential('Twitter username/phone/email')
            : incomingUsername;

        const finalPassword = (!incomingPassword)
            ? await CommandLineCredentialsPrompter.promptCredential('Twitter password')
            : incomingPassword;

        const credentials: ValidUsernamePasswordCredentials = {
            username: finalUsername,
            password: finalPassword
        };

        return credentials;
    }

    protected static async promptCredential(prompt: string): Promise<string> {
        const credential = await this.promptForAnswer(prompt);
        if(!credential)
            return this.promptCredential(prompt);

        return credential;
    }

    protected static async promptForAnswer(prompt: string) {
        const formattedPrompt = prompt + ': ';
        return passwordPrompt(formattedPrompt, {
            method: 'hide'
        });
    }
}
