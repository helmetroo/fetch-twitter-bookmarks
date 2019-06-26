import UsernamePasswordCredentials from './username-password-credentials';

type ValidCredentials<T extends UsernamePasswordCredentials> {
    readonly [C in UsernamePasswordCredentials]: NonNullable<T[C]>;
}

type ValidUsernamePasswordCredentials = validCredentials<UsernamePasswordCredentials>;
export default ValidUsernamePasswordCredentials;
