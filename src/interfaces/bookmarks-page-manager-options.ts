import ValidUsernamePasswordCredentials from './username-password-credentials';

export default interface PageManagerOptions {
    credentials: ValidUsernamePasswordCredentials;
    chromePath: string | null;
    manualQuit: boolean;
    inspect: boolean:
}
