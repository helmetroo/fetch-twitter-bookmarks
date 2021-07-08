export class TwitterRequestError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'TwitterRequestError';
    }
}

export enum LoginErrorType {
    IncorrectCredentials,
    IncorrectAuthCode,
    RequiresUsernameOrPhoneOnly,
    RequiresAuthCode,
}
export class TwitterLoginError extends Error {
    constructor(
        readonly type: LoginErrorType,
        reason: string
    ) {
        super(reason);
        this.name = 'TwitterLoginError';
    }
}

export class ConnectionError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ConnectionError';
    }
}
