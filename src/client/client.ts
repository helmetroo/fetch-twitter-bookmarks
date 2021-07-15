import { URL } from 'url';
import { writeFile as writeFileCb } from 'fs';
import { promisify } from 'util';

import { BrowserType, chromium, firefox, webkit } from 'playwright';
import type { Request, Response } from 'playwright';
import { TypedEmitter } from 'tiny-typed-emitter';
import { createLogger, format, transports } from 'winston';
import type { Logger } from 'winston';

import rootPathTo from '../utils/root-path-to';
import { Application } from '../constants/application';
import { Twitter } from '../constants/twitter';
import {
    ApplicationError,
    TwitterHttpRequestError,
    TwitterLoginError,
    LoginErrorType,
    PageManagerInitError,
    PageManagerTimeoutError,
    DumpFileError,
    TwitterLogoutError,
    RequesterError,
} from '../constants/error';

import fetchAvailableBrowsers from '../utils/fetch-available-browsers';

import Credentials, { AuthorizationCode } from './credentials';
import PageManager from './page-manager';
import DataExtractor from './data-extractor';
import { TweetsDB } from './tweets-db';
import { BookmarksRequester } from './bookmarks-requester';

export type BrowserName = 'chromium' | 'firefox' | 'webkit';
type NameToBrowserType = {
    [key in BrowserName]: BrowserType
};

const NAME_TO_BROWSER: NameToBrowserType = {
    'chromium': chromium,
    'firefox': firefox,
    'webkit': webkit
}

export enum State {
    NotReady = 'NotReady',
    LoggedOut = 'LoggedOut',
    LoggedIn = 'LoggedIn',
    FetchingBookmarks = 'FetchingBookmarks'
}

export enum ErrorType {
    Internal,
    User
}

export interface ClientEvents {
    notice: (message: string) => void;
    error: (type: ErrorType, message: string, ...rest: string[]) => void;
    transition: (oldState: State, newState: State) => void;
}

export type ClientEventKey = keyof ClientEvents;

const writeFile = promisify(writeFileCb);

export default class Client extends TypedEmitter<ClientEvents> {
    protected availableBrowserNames: string[];

    protected pageManager: PageManager;
    protected db: TweetsDB.Database;
    protected bookmarksRequester?: BookmarksRequester.Requester;
    protected logger: Logger;

    protected currentState: State = State.NotReady;
    protected loggedIn: boolean = false;

    get ready() {
        return this.state !== State.NotReady;
    }

    get availableBrowserNamesByCommas() {
        return this.availableBrowserNames
            .join(', ');
    }

    get availableBrowserNamesInQuotes() {
        return this.availableBrowserNames
            .map(name => `"${name}"`)
            .join(', ');
    }

    get state() {
        return this.currentState;
    }

    protected set state(newState: State) {
        const prevState = this.currentState;
        this.currentState = newState;

        this.emit('transition', prevState, newState);
    }

    constructor() {
        super();

        this.availableBrowserNames = [];

        // TODO allow frontends to config
        this.db = new TweetsDB.Database({
            inMemory: false,
            logging: this.logDebug.bind(this)
        });
        this.pageManager = new PageManager();
        this.logger = createLogger({
            transports: [
                new transports.File({
                    level: 'debug',
                    format: format.combine(
                        format.timestamp(),
                        format.prettyPrint(),
                        format.errors({
                            stack: true
                        }),
                        Client.createFileLogFormatter(),
                    ),
                    filename: rootPathTo('/logs/debug.log')
                })
            ],

            exceptionHandlers: [
                new transports.File({
                    filename: rootPathTo('/logs/exceptions.log')
                })
            ]
        });
    }

    protected static createFileLogFormatter() {
        return format.printf((info) => {
            const logMessage = `${info.timestamp} [${info.level}]: ${info.message}`;

            return info.stack
                ? `${logMessage}\r\n\t${info.stack}`
                : logMessage;
        });
    }

    protected emitNotice(message: string) {
        this.emit('notice', message);
    }

    protected logHttpEvent(
        url: string,
        method: string,
        params: URLSearchParams,
        header: Twitter.Api.RequestHeader
    ) {
        const message = [
            `Making ${method} request to ${url}`,
            `Params: ${params.toString()}`,
            `Header: ${JSON.stringify(header)}`
        ].join('\r\n\t');

        this.logDebug(message);
    }

    protected logDebug(message: string) {
        this.logger.log({
            level: 'debug',
            message
        })
    }

    protected emitUserError(message: string) {
        this.emit('error', ErrorType.User, message);
    }

    protected emitAndLogInternalError(err: ApplicationError) {
        this.emitInternalError(err);
        this.logInternalError(err);
    }

    protected emitInternalError(err: ApplicationError) {
        const message = (err.userMessage)
            ? err.userMessage
            : `Internal error: ${err.message}`;

        this.emit('error', ErrorType.Internal, message);
    }

    protected logInternalError(err: ApplicationError) {
        this.logger.error(err);
    }

    protected assertPageManagerReady() {
        if(!this.ready) {
            const errorMessage = [
                'Page manager had not been initialized correctly.',
                'The page manager is necessary to sign in on your behalf to Twitter and start the process of fetching bookmarks.'
            ].join('');

            const unreadyError = new PageManagerInitError(errorMessage);
            this.emitAndLogInternalError(unreadyError);
            return false;
        }

        return true;
    }

    async determineAvailableBrowsers() {
        const availableBrowsers = await fetchAvailableBrowsers();
        this.availableBrowserNames = availableBrowsers.map(browser => browser.name);
        this.emitNotice(`Available browsers to use: ${this.availableBrowserNamesByCommas}.`);
        return this.availableBrowserNames;
    }

    async initBrowser(browserName: BrowserName) {
        const browserType = NAME_TO_BROWSER[browserName];
        if(!browserType) {
            this.emitUserError(`Please choose from ${this.availableBrowserNamesInQuotes}.`);
            return;
        }

        this.pageManager.setBrowserType(browserType);
        await this.pageManager.init();
        this.emitNotice(`Browser set to ${browserName} and initialized. You may now login.`);

        this.state = State.LoggedOut;
    }

    async initDb() {
        try {
            await this.db.init();
        } catch(err) {
            this.emitAndLogInternalError(err);
            return;
        }

        this.emitNotice('Bookmarks database ready.');
    }

    async closeDb() {
        try {
            await this.db.close();
        } catch(err) {
            this.emitAndLogInternalError(err);
            return;
        }

        this.emitNotice('Closed connection to bookmarks database.');
    }

    async logIn(credentials: Credentials) {
        if(!this.assertPageManagerReady())
            return;

        try {
            const {
                logIn,
                logInError
            } = Twitter.Url.PATHNAMES;

            const atLoginPage =
                this.pageManager.currentUrlHasPath(logIn) ||
                this.pageManager.currentUrlHasPath(logInError);
            if(!atLoginPage)
                await this.pageManager.goToLogInPage();

            await this.pageManager.logIn(credentials);
        } catch(err) {
            const userMsg = [
                'The browser took too long to log you in.',
                'There may be a connection issue, server problem with Twitter, or other login problem not handled by this app.',
                'Please try again.'
            ].join('\r\n');
            const timeoutErr = new PageManagerTimeoutError(err, userMsg);
            this.emitAndLogInternalError(timeoutErr);

            return;
        }

        const notAtHomePage =
            !this.pageManager.currentUrlHasPath(Twitter.Url.PATHNAMES.home);
        if(notAtHomePage)
            return this.throwLoginError();

        this.markLoggedIn();
    }

    protected throwLoginError() {
        const {
            logIn,
            challengeCode,
            twoFaCode,
        } = Twitter.Url.PATHNAMES;

        const requiresUsernameOrPhoneOnly =
            this.pageManager.currentUrlHasPath(logIn) &&
            this.pageManager.currentUrlHasQueryParamSet('email_disabled');

        if(requiresUsernameOrPhoneOnly) {
            throw new TwitterLoginError(
                LoginErrorType.RequiresUsernameOrPhoneOnly,
                'Due to a high number of login attempts, Twitter would like you to signin with your username/phone.'
            );
        }

        const requiresChallengeCode = this.pageManager.currentUrlHasPath(challengeCode);
        const requires2FACode = this.pageManager.currentUrlHasPath(twoFaCode);
        const requiresAuthCode = requires2FACode || requiresChallengeCode;
        if(requiresAuthCode) {
            const errMessage = (requiresChallengeCode)
                ? 'Your confirmation code is necessary to proceed.'
                : 'Your 2FA code is necessary to proceed.';

            throw new TwitterLoginError(
                LoginErrorType.RequiresAuthCode,
                errMessage
            );
        }

        throw new TwitterLoginError(
            LoginErrorType.IncorrectCredentials,
            'Your credentials were incorrect.'
        );
    }

    async enterAuthorizationCode(authCode: AuthorizationCode) {
        if(!this.assertPageManagerReady())
            return;

        await this.pageManager.enterAuthorizationCode(authCode.value);

        const notAtHomePage =
            !this.pageManager.currentUrlHasPath(Twitter.Url.PATHNAMES.home);
        if(notAtHomePage) {
            throw new TwitterLoginError(
                LoginErrorType.IncorrectAuthCode,
                'The code you entered was incorrect or expired.'
            );
        }

        this.markLoggedIn();
    }

    protected markLoggedIn() {
        this.state = State.LoggedIn;
        this.loggedIn = true;

        this.emitNotice('Successfully logged in.');
    }

    async startFetchingBookmarks() {
        await this.pageManager.goToBookmarksPage();

        // TODO allow user to retry (by refreshing the page and waiting for the req/res pair again)
        // TODO allow user to specify cursor or options specifying if they want to use the last cursor or not
        try {
            const config = await this.generateRequesterConfig();
            const lastSavedCursor = await this.db.getCursorState();
            if(lastSavedCursor) {
                config.initialCursor = lastSavedCursor;
                this.emitNotice(`Retrieving bookmarks from last cursor: ${lastSavedCursor.bottom}`);
            } else {
                await this.saveCursorAndBookmarks(config.initialCursor, config.initialBookmarks);
                this.emitNotice(`Saved ${config.initialBookmarks.length} initial bookmarks and cursor to database.`);
            }

            this.startRequesterProcess(config);
        } catch(err) {
            this.emitAndLogInternalError(err);
        }

        this.state = State.FetchingBookmarks;
    }

    protected async saveCursorAndBookmarks(cursor: Application.Cursor, bookmarks: Application.Tweet[]) {
        await this.db.persistCursorState(cursor);
        await this.db.insertTweets(bookmarks);
    }

    protected async generateRequesterConfig() {
        let req: Request;
        let res: Response;
        try {
            const bookmarksPathnameRegex = Twitter.Url.PATH_REGEXES.bookmarks;
            [req, res] = await Promise.all([
                this.pageManager.waitForRequest(bookmarksPathnameRegex),
                this.pageManager.waitForResponse(bookmarksPathnameRegex)
            ]);
        } catch(err) {
            const userMsg = `It took too long to wait for information about Twitter's bookmark endpoint.`;
            throw new PageManagerTimeoutError(err, userMsg);
        }

        return this.buildRequesterConfigFrom(req, res);
    }

    protected async buildRequesterConfigFrom(req: Request, res: Response): Promise<BookmarksRequester.ConfigWithBookmarks> {
        const reqHeader = <Twitter.Api.PlaywrightHeader> (req.headers() as unknown);
        const reqUrl = new URL(req.url());
        this.logHttpEvent(reqUrl.toString(), req.method(), reqUrl.searchParams, reqHeader);

        const reqFailed = !res.ok();
        if(reqFailed)
            throw TwitterHttpRequestError.fromPlaywright(req, res);

        const resBody = <Twitter.Api.SuccessResponse> await res.json();
        const dataExtractor = new DataExtractor(resBody);
        const initialCursor = dataExtractor.cursor;
        const initialBookmarks = dataExtractor.tweets;
        return {
            reqUrl,
            reqHeader,
            initialCursor,
            initialBookmarks
        };
    }

    protected startRequesterProcess(config: BookmarksRequester.Config) {
        this.bookmarksRequester = new BookmarksRequester.Requester(config);
        this.listenForRequesterEvents(this.bookmarksRequester);
        this.bookmarksRequester.startRequestLoop();

        this.state = State.FetchingBookmarks;
    }

    protected listenForRequesterEvents(requester: BookmarksRequester.Requester) {
        requester.on('http', this.logHttpEvent.bind(this));
        requester.on('fetched', this.handleRequesterProgress.bind(this));
        requester.on('error', this.handleRequesterError.bind(this));
        requester.on('end', this.handleRequesterFinished.bind(this));
    }

    protected async handleRequesterProgress(cursor: Application.Cursor, bookmarks: Application.Tweet[]) {
        try {
            await this.saveCursorAndBookmarks(cursor, bookmarks);
        } catch(err) {
            const requesterErr = new RequesterError(err, 'There was an error saving the last fetched bookmarks.');
            this.emitAndLogInternalError(requesterErr);
            this.stopFetchingBookmarks();

            return;
        }

        this.emitNotice(`${bookmarks.length} bookmarks were fetched and saved to the database.`);
    }

    protected handleRequesterLog(message: string) {
        this.emitNotice(message);
    }

    protected handleRequesterError(err: ApplicationError) {
        debugger;
        const requesterErr = new RequesterError(err, 'An error was encountered fetching bookmarks.');
        this.emitAndLogInternalError(requesterErr);

        this.state = State.LoggedIn;
    }

    protected handleRequesterFinished() {
        this.emitNotice('No more bookmarks to fetch, the end may have been reached.');
    }

    stopFetchingBookmarks() {
        this.stopBookmarksRequester();
        this.state = State.LoggedIn;

        this.emitNotice('Bookmark fetching has stopped.');
    }

    protected stopBookmarksRequester() {
        this.bookmarksRequester?.stopRequestLoop();
    }

    async dumpBookmarks(filePath: string) {
        let authors: TweetsDB.Author[] = [];
        let bookmarks: TweetsDB.Tweet[] = [];

        let authorObjs: object[] = [];
        let bookmarkObjs: object[] = [];
        try {
            authors = await this.db.getAllAuthors();
            authorObjs = authors.map(author => author.toJSON());

            bookmarks = await this.db.getAllTweets();
            bookmarkObjs = bookmarks.map(bookmark => bookmark.toJSON());
        } catch(err) {
            this.emitAndLogInternalError(err);
            return;
        }

        // TODO if there are a lot to write, do we need to chunkify writing somehow?
        // TODO if file already exists, should prompt user if they want to overwrite it
        try {
            const serializedBookmarks = JSON.stringify({
                authors: authorObjs,
                bookmarks: bookmarkObjs
            });

            await writeFile(filePath, serializedBookmarks, 'utf8');
            this.emitNotice(`${bookmarks.length} bookmarks have been successfully dumped to ${filePath}.`)
        } catch(err) {
            const dumpErrorMsg = [
                `Unable to save bookmarks at ${filePath}.`,
                `The disk may be full/not responding or you have insufficient permissions.`
            ].join('\r\n');
            const dumpErr = new DumpFileError(err, dumpErrorMsg);
            this.emitAndLogInternalError(dumpErr);
        }
    }

    async logOut() {
        if(!this.ready)
            return;

        await this.pageManager.logOut();

        if(this.pageManager.currentUrlHasPath(Twitter.Url.PATHNAMES.loggedOut)) {
            this.state = State.LoggedOut;
            return;
        }

        const logoutErrMsg = 'Although a logout attempt was made, you may not have been properly logged out.';
        const logoutError = new TwitterLogoutError(logoutErrMsg);
        this.emitAndLogInternalError(logoutError);
    }

    async end() {
        this.stopBookmarksRequester();

        if(this.loggedIn)
            await this.logOut();

        await this.pageManager.tearDown();
        this.state = State.NotReady;

        this.emitNotice('Your session has ended. You can now select a different browser to use or exit.')
    }
}
