import { errors as PlaywrightErrors } from 'playwright';
import type {
    Request as PlaywrightRequest,
    Response as PlaywrightResponse
} from 'playwright';
import type { BaseError } from 'sequelize';
import type { SuperAgentRequest, HTTPError, ResponseError } from 'superagent';

import { Twitter } from './twitter';

export interface ApplicationErrorOpts {
    readonly sourceError?: Error;
    readonly userMessage: string;
}
export class ApplicationError extends Error implements ApplicationErrorOpts {
    readonly sourceError?: Error;
    readonly userMessage: string;

    constructor(opts: ApplicationErrorOpts) {
        const message = opts.sourceError?.message ?? opts.userMessage;
        super(message);

        this.sourceError = opts.sourceError;
        this.userMessage = opts.userMessage;
    }

    get stack(): string {
        return this.sourceError?.stack ?? this.stack;
    }
}

export class PageManagerInitError extends ApplicationError {
    constructor(userMessage: string) {
        super({
            userMessage
        });
        this.name = 'PageManagerInitError';
    }
}

export class PageManagerTimeoutError extends ApplicationError {
    constructor(sourceError: PlaywrightErrors.TimeoutError, userMessage: string) {
        super({
            sourceError,
            userMessage
        });
        this.name = 'PageManagerTimeoutError';
    }
}

export class DumpFileError extends ApplicationError {
    constructor(sourceError: Error, userMessage: string) {
        super({
            sourceError,
            userMessage
        });
        this.name = 'DumpFileError';
    }
}

export enum LoginErrorType {
    IncorrectCredentials,
    IncorrectAuthCode,
    RequiresUsernameOrPhoneOnly,
    RequiresAuthCode,
}
export class TwitterLoginError extends ApplicationError {
    constructor(
        readonly type: LoginErrorType,
        userMessage: string
    ) {
        super({
            userMessage
        });
        this.name = 'TwitterLoginError';
    }
}

export class TwitterLogoutError extends ApplicationError {
    constructor(
        userMessage: string
    ) {
        super({
            userMessage
        });
        this.name = 'TwitterLogoutError';
    }
}

export interface HttpRequest {
    method: string;
    url: string;
    headers: Twitter.Api.RequestHeader;
}

export interface HttpResponse {
    status: number;
    text?: string;
    errors?: Twitter.Api.Error[];
}

export type SuperAgentRequestWithHeaders = SuperAgentRequest & {
    headers: HttpRequest['headers'];
}
export class TwitterHttpRequestError extends ApplicationError {
    static readonly NO_CONNECTION_MESSAGE = `Could not establish a connection to Twitter.`;
    static readonly API_ERROR_MESSAGE = `The Twitter API returned an error.`;

    constructor(
        sourceError: Error | undefined,
        userMessage: string,
        readonly request: HttpRequest,
        readonly response?: HttpResponse,
    ) {
        super({
            sourceError,
            userMessage
        });

        this.name = 'TwitterHttpRequestError';
    }

    static async fromPlaywright(
        req: PlaywrightRequest,
        res: PlaywrightResponse
    ) {
        const request: HttpRequest = {
            method: req.method().toLowerCase(),
            url: req.url(),
            headers: <Twitter.Api.RequestHeader> (req.headers() as unknown)
        };

        const response: HttpResponse = {
            status: res.status()
        };

        try {
            // Response should be API error
            const resBody = <Twitter.Api.ErrorResponse> await res.json();
            response.errors = resBody.errors ?? [];
        } catch(err) {
            try {
                // Still a response, but not in the format we expect
                response.text = await res.text();
            } catch(err) {
                // No response
                return new TwitterHttpRequestError(
                    undefined, TwitterHttpRequestError.NO_CONNECTION_MESSAGE, request
                );
            }
        }

        return new TwitterHttpRequestError(
            undefined, TwitterHttpRequestError.API_ERROR_MESSAGE, request, response
        );
    }

    static fromSuperagent(err: Error, req: SuperAgentRequestWithHeaders) {
        const resErr = <ResponseError> err;
        const resErrResponse = resErr.response;
        if(!resErrResponse) {
            // NOTE err seems to be a NodeJS.ErrnoException & { response: ..., hostname: ... }
            return new TwitterHttpRequestError(
                resErr, TwitterHttpRequestError.NO_CONNECTION_MESSAGE, req
            );
        }

        const reqData: HttpRequest = {
            method: req.method.toLowerCase(),
            url: req.url,
            headers: req.headers
        };

        const httpErr = <HTTPError> err;
        const resData: HttpResponse = {
            status: httpErr.status,
            text: resErrResponse.text,
            errors: resErrResponse.body?.errors ?? []
        }

        return new TwitterHttpRequestError(
            err, TwitterHttpRequestError.API_ERROR_MESSAGE, reqData, resData
        );
    }
}

export class RequesterError extends ApplicationError {
    constructor(sourceError: ApplicationError, headerMessage: string) {
        const userMessage = [
            headerMessage,
            sourceError.message
        ].join('\r\n');

        super({
            sourceError,
            userMessage
        });
        this.name = 'RequesterError';
    }
}

export class DatabaseError extends ApplicationError {
    constructor(
        sourceError: BaseError,
        userMessage: string
    ) {
        super({
            sourceError,
            userMessage
        });
        this.name = 'DatabaseError';
    }
}

export class DatabaseRequiredError extends ApplicationError {
    constructor(
        userMessage: string
    ) {
        super({
            userMessage
        });
        this.name = 'DatabaseRequiredError';
    }
}

export class RemoveLogFileError extends ApplicationError {
    constructor(
        sourceError: Error,
        userMessage: string
    ) {
        super({
            sourceError,
            userMessage
        });
        this.name = 'RemoveLogFileError';
    }
}
