import { URL } from 'url';
import { writeFile as writeFileCb } from 'fs';
import { promisify } from 'util';

import { BrowserType, chromium, firefox, webkit } from 'playwright';
import type { Request, Response } from 'playwright';
import { TypedEmitter } from 'tiny-typed-emitter';

import { Application } from '../constants/application';
import { Twitter } from '../constants/twitter';
import { TwitterRequestError, ConnectionError, TwitterLoginError, LoginErrorType } from '../constants/error';

import fetchAvailableBrowsers from '../utils/fetch-available-browsers';

import Credentials, { AuthorizationCode } from './credentials';
import PageManager from './page-manager';
import DataExtractor from './data-extractor';
import { TweetsDB } from './tweets-db';
import { BookmarksRequester } from './bookmarks-requester';
import { ValidationError } from 'sequelize';

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

        // TODO allow frontends to config
        this.db = new TweetsDB.Database({
            inMemory: false,
            logging: false
        });
        this.pageManager = new PageManager();
        this.availableBrowserNames = [];
    }

    protected emitNotice(message: string) {
        this.emit('notice', message);
    }

    protected emitUserError(message: string) {
        this.emit('error', ErrorType.User, message);
    }

    protected emitInternalError(message: string) {
        this.emit('error', ErrorType.Internal, message);
    }

    protected assertPageManagerReady() {
        if(!this.ready) {
            const errorMessage = [
                'Page manager had not been initialized correctly.',
                'The page manager is necessary to sign in on your behalf to Twitter and start the process of fetching bookmarks.'
            ].join('');

            this.emitInternalError(errorMessage);
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
        await this.db.init();
        this.emitNotice('Bookmarks database ready.');
    }

    async closeDb() {
        await this.db.close();
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
            const timeoutErrMsg = [
                'The browser took too long to log you in.',
                'There may be a connection issue, server problem with Twitter, or other login problem not handled by this app.',
                'Please try again.'
            ].join('\r\n');
            this.emitInternalError(timeoutErrMsg);
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
                this.emitNotice('Saved initial bookmarks and cursor to database.');
            }

            this.startRequesterProcess(config);
        } catch(err) {
            const errMessage = err.message;
            this.emitInternalError(errMessage);
        }

        this.state = State.FetchingBookmarks;
    }

    protected async saveCursorAndBookmarks(cursor: Application.Cursor, bookmarks: Application.Tweet[]) {
        await this.db.persistCursorState(cursor);
        try {
            await this.db.insertTweets(bookmarks);
        } catch(err) {
            if(err instanceof ValidationError) {
                this.emitInternalError(`Validation error trying to save tweets & authors: ${JSON.stringify(err.errors)}`);
                return;
            }

            this.emitInternalError(`Save error encountered: ${err.message}`);
        }
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
            throw new ConnectionError('Could not connect to Twitter to fetch bookmarks. There may be a connection issue.');
        }

        return this.buildRequesterConfigFrom(req, res);
    }

    protected async buildRequesterConfigFrom(req: Request, res: Response): Promise<BookmarksRequester.ConfigWithBookmarks> {
        const reqHeader = <Twitter.Api.PlaywrightHeader> (req.headers() as unknown);
        const reqUrl = new URL(req.url());

        const resBody = <Twitter.Api.Response> await res.json();
        const resBodyAsError = <Twitter.Api.ErrorResponse> resBody;
        if(resBodyAsError.errors) {
            const twtrErrMessage = resBodyAsError.errors[0].message;
            throw new TwitterRequestError(`Twitter gave an error attempting to fetch bookmarks. Message given: ${twtrErrMessage}`);
        }

        const dataExtractor = new DataExtractor(<Twitter.Api.SuccessResponse> resBody);
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
        requester.on('fetched', this.handleRequesterProgress.bind(this));
        requester.on('log', this.handleRequesterLog.bind(this));
        requester.on('error', this.handleRequesterError.bind(this));
        requester.on('end', this.handleRequesterFinished.bind(this));
    }

    protected async handleRequesterProgress(cursor: Application.Cursor, bookmarks: Application.Tweet[]) {
        await this.saveCursorAndBookmarks(cursor, bookmarks);
        this.emitNotice(`${bookmarks.length} bookmarks were fetched and saved to the database.`);
    }

    protected handleRequesterLog(message: string) {
        // TODO use dedicated logger for this
        this.emitNotice(message);
    }

    protected handleRequesterError(requesterErrMessage: string) {
        const message = `Fetching stopped due to a problem fetching bookmarks. ${requesterErrMessage}`;
        this.emitInternalError(message);

        this.state = State.LoggedIn;
    }

    protected handleRequesterFinished() {
        this.emitNotice('No more bookmarks to fetch, the end may have been reached.');
    }

    stopFetchingBookmarks() {
        this.stopBookmarksRequester();
        this.state = State.LoggedIn;
    }

    protected stopBookmarksRequester() {
        this.bookmarksRequester?.stopRequestLoop();
    }

    async dumpBookmarks(filePath: string) {
        // TODO if there are a lot to write, do we need to chunkify writing somehow?
        // TODO if file already exists, should prompt user if they want to overwrite it
        const authors = await this.db.getAllAuthors();
        const authorObjs = authors.map(author => author.toJSON());

        const bookmarks = await this.db.getAllTweets();
        const bookmarkObjs = bookmarks.map(bookmark => bookmark.toJSON());

        const serializedBookmarks = JSON.stringify({
            authors: authorObjs,
            bookmarks: bookmarkObjs
        });

        await writeFile(filePath, serializedBookmarks, 'utf8');
        this.emitNotice(`${bookmarks.length} bookmarks have been successfully dumped to ${filePath}.`)
    }

    async logOut() {
        if(!this.ready)
            return;

        await this.pageManager.logOut();

        if(this.pageManager.currentUrlHasPath(Twitter.Url.PATHNAMES.loggedOut)) {
            this.state = State.LoggedOut;
            return;
        }

        this.emitInternalError('Although a logout attempt was made, you may not have been properly logged out.');
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
