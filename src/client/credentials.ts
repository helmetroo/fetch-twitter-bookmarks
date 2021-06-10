export default interface Credentials {
    username: string;
    password: string;
}

export const INVALID_CREDENTIALS: Credentials = {
    username: ' ',
    password: ' '
};
