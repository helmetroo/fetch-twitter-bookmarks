import { URL } from 'url';
import { writeFile as writeFileCb } from 'fs';
import { promisify } from 'util';

import { BrowserType, chromium, firefox, webkit } from 'playwright';
import type { Request, Response } from 'playwright';
import { TypedEmitter } from 'tiny-typed-emitter';

import fetchAvailableBrowsers from '../utils/fetch-available-browsers';
import { Application } from '../constants/application';
import { Twitter } from '../constants/twitter';
import { TwitterRequestError, ConnectionError } from '../constants/error';
import Credentials from './credentials';
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
    actionRequired: (reason: string) => void;
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
    protected lastAuthAttemptFailed: boolean = false;
    protected lastCodeAttemptFailed: boolean = false;

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

    protected emitActionRequired(reason: string) {
        this.emit('actionRequired', reason);
    }

    protected assertPageManagerReady() {
        if(!this.ready) {
            const errorMessage = [
                'Page manager had not been initialized correctly.',
                'The page manager is necessary to sign in on your behalf to Twitter and start the process of fetching bookmarks.'
            ].join('');

            this.emitInternalError(errorMessage);
        }
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
        if(!this.ready) {
            this.emitInternalError(`The browser hasn't been initialized yet.`);
            return;
        }

        this.lastAuthAttemptFailed = false;
        await this.pageManager.logIn(credentials);
        if(!this.pageManager.currentUrlHasPath(Twitter.Url.PATHNAMES.home))
            return this.handleLoginIssue();

        this.markLoggedIn();
    }

    protected markLoggedIn() {
        this.state = State.LoggedIn;
        this.loggedIn = true;
        this.emitNotice('Successfully logged in.');
    }

    protected async handleLoginIssue() {
        const {
            challengeCode,
            twoFaCode,
        } = Twitter.Url.PATHNAMES;

        if(this.pageManager.currentUrlHasPath(challengeCode)) {
            this.emitActionRequired('Your confirmation code is necessary to proceed.');
        } else if(this.pageManager.currentUrlHasPath(twoFaCode)) {
            this.emitActionRequired('Your 2FA code is necessary to proceed. Please check your device.');
        } else {
            this.lastAuthAttemptFailed = true;
            this.emitUserError('Your credentials were incorrect.');
        }
    }

    async enterConfirmationCode(code: string) {
        this.assertPageManagerReady();

        this.lastCodeAttemptFailed = false;
        await this.pageManager.enterConfirmationCode(code);
        if(this.pageManager.currentUrlHasPath(Twitter.Url.PATHNAMES.challengeCode)) {
            this.lastCodeAttemptFailed = true;
            this.emitUserError('Your challenge code was incorrect.');
        }

        this.markLoggedIn();
    }

    async enterTwoFactorCode(code: string) {
        this.assertPageManagerReady();

        this.lastCodeAttemptFailed = false;
        await this.pageManager.enterTwoFactorCode(code);
        if(this.pageManager.currentUrlHasPath(Twitter.Url.PATHNAMES.twoFaCode)) {
            this.lastCodeAttemptFailed = true;
            this.emitUserError('Your 2FA code was incorrect.');
        }

        this.markLoggedIn();
    }

    async startFetchingBookmarks() {
        await this.pageManager.goToBookmarksPage();

        // TODO allow user to retry (by refreshing the page and waiting for the req/res pair again)
        try {
            const config = await this.generateRequesterConfig();
            await this.persistInitialState(config.startCursor, config.initialBookmarks);
            this.startRequester(config);
        } catch(err) {
            const errMessage = err.message;
            this.emitInternalError(errMessage);
        }

        this.state = State.FetchingBookmarks;
    }

    protected async persistInitialState(cursor: Application.Cursor, bookmarks: Application.Tweet[]) {
        await this.db.persistCursorState(cursor);
        await this.db.insertTweets(bookmarks);
        this.emitNotice('Saved initial bookmarks and cursor to database.');
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
        const reqHeader = <Twitter.Api.RequestHeader> (req.headers() as unknown);
        const reqUrl = new URL(req.url());

        const resBody = <Twitter.Api.Response> await res.json();
        const resBodyAsError = <Twitter.Api.ErrorResponse> resBody;
        if(resBodyAsError.errors) {
            const twtrErrMessage = resBodyAsError.errors[0].message;
            throw new TwitterRequestError(`Twitter gave an error attempting to fetch bookmarks. Message given: ${twtrErrMessage}`);
        }

        const dataExtractor = new DataExtractor(<Twitter.Api.SuccessResponse> resBody);
        const startCursor = dataExtractor.cursor;
        const initialBookmarks = dataExtractor.tweets;
        return {
            reqUrl,
            reqHeader,
            startCursor,
            initialBookmarks
        };
    }

    protected startRequester(config: BookmarksRequester.Config) {
        this.bookmarksRequester = new BookmarksRequester.Requester(config, this.db);
        this.bookmarksRequester.start();

        this.state = State.FetchingBookmarks;
    }

    protected listenForRequesterEvents() {
        this.bookmarksRequester?.on('fetched', this.notifyRequesterProgress.bind(this));
        this.bookmarksRequester?.on('error', this.notifyRequesterError.bind(this));
        this.bookmarksRequester?.on('end', this.notifyRequesterFinished.bind(this));
    }

    protected notifyRequesterError(message: string) {
        this.emitInternalError(message);
    }

    protected notifyRequesterProgress(bookmarks: Application.Tweet[]) {
        this.emitNotice(`${bookmarks.length} bookmarks have been fetched and saved to the database.`);
    }

    protected notifyRequesterFinished() {
        this.emitNotice('No more bookmarks to fetch, the end may have been reached.');
    }

    stopFetchingBookmarks() {
        this.bookmarksRequester?.stop();
        this.state = State.LoggedIn;
    }

    async dumpBookmarks(filePath: string) {
        // TODO if there are a lot to write, do we need to chunkify writing somehow?
        const bookmarks = await this.db.getAllTweets();
        const bookmarkObjs = bookmarks.map(bookmark => bookmark.toJSON());
        const serializedBookmarks = JSON.stringify({ bookmarks: bookmarkObjs });
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
        this.bookmarksRequester?.stop();

        if(this.loggedIn)
            await this.logOut();

        await this.pageManager.tearDown();
        this.state = State.NotReady;
    }
}
