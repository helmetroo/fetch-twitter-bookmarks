import UsernamePasswordCredentials from './username-password-credentials';

export default interface PageManagerOptions {
    credentials: UsernamePasswordCredentials;
    chromePath: string | null;
}
