import UsernamePasswordCredentials from '@interfaces/username-password-credentials';
import ValidUsernamePasswordCredentials from '@interfaces/valid-username-password-credentials';

import CredentialsPrompter from './credentials-prompter';

export default class TestableCredentialsPrompter extends CredentialsPrompter {
    public async prompt(currentCredentials: UsernamePasswordCredentials) {
        const {
            username: incomingUsername,
            password: incomingPassword
        } = currentCredentials;

        const missingEitherCredential = !incomingUsername || !incomingPassword;

        if(missingEitherCredential) {
            const missingCredsErr = new Error('Username and password are required.');
            throw missingCredsErr;
        }

        return <ValidUsernamePasswordCredentials> currentCredentials;
    }
}
