import UsernamePasswordCredentials from './username-password-credentials';

type ValidCredentials<T extends UsernamePasswordCredentials> {
    readonly [C in keyof UsernamePasswordCredentials]: NonNullable<T[C]>;
}

type ValidUsernamePasswordCredentials = ValidCredentials<UsernamePasswordCredentials>;
export default ValidUsernamePasswordCredentials;
