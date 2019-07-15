import UsernamePasswordCredentials from '@interfaces/username-password-credentials';
import ValidUsernamePasswordCredentials from '@interfaces/valid-username-password-credentials';

export default abstract class CredentialsPrompter {
    public abstract async prompt(currentCredentials: UsernamePasswordCredentials): Promise<ValidUsernamePasswordCredentials>;
}
