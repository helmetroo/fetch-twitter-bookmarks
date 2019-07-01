import ValidUsernamePasswordCredentials from './valid-username-password-credentials';

export default interface BookmarksPageProviderOptions {
    credentials: ValidUsernamePasswordCredentials;
    chromePath: string | null;
    manualQuit: boolean;
    inspect: boolean:
}
