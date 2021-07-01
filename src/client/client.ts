import { URL } from 'url';

import { BrowserType, chromium, firefox, webkit } from 'playwright';
import { TypedEmitter } from 'tiny-typed-emitter';

import fetchAvailableBrowsers from '../utils/fetch-available-browsers';
import { Twitter } from '../constants/twitter';
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

export default class Client extends TypedEmitter<ClientEvents> {
    protected availableBrowserNames: string[];

    protected pageManager: PageManager;
    protected db: TweetsDB.Database;

    protected currentState: State = State.NotReady;
    protected lastAuthAttemptFailed: boolean = false;
    protected lastCodeAttemptFailed: boolean = false;

    get availableBrowserNamesQuoted() {
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

    get notReady() {
        return this.state === State.NotReady;
    }

    get loggedOut() {
        return this.state === State.LoggedOut;
    }

    get loggedIn() {
        return this.state === State.LoggedIn;
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
        if(this.notReady) {
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
        this.emitNotice(`Available browsers to use: ${this.availableBrowserNamesQuoted}.`);
        return this.availableBrowserNames;
    }

    async initBrowser(browserName: BrowserName) {
        const browserType = NAME_TO_BROWSER[browserName];
        if(!browserType) {
            this.emitUserError(`Please choose from ${this.availableBrowserNamesQuoted}.`);
            return;
        }

        this.pageManager.setBrowserType(browserType);
        await this.pageManager.init();
        this.emitNotice(`Browser set to ${browserName} and initialized.`);

        this.state = State.LoggedOut;
    }

    async initDb() {
        await this.db.init();
        this.emitNotice('Bookmarks database ready.');
    }

    async logIn(credentials: Credentials) {
        if(this.notReady) {
            this.emitInternalError(`The browser hasn't been initialized yet.`);
            return;
        }

        this.lastAuthAttemptFailed = false;
        await this.pageManager.logIn(credentials);
        if(!this.pageManager.currentUrlHasPath(Twitter.Url.PATHNAMES.home))
            return this.handleLoginIssue();

        this.state = State.LoggedIn;
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

        this.emitNotice('Successfully logged in.');
    }

    async enterTwoFactorCode(code: string) {
        this.assertPageManagerReady();

        this.lastCodeAttemptFailed = false;
        await this.pageManager.enterTwoFactorCode(code);
        if(this.pageManager.currentUrlHasPath(Twitter.Url.PATHNAMES.twoFaCode)) {
            this.lastCodeAttemptFailed = true;
            this.emitUserError('Your 2FA code was incorrect.');
        }

        this.emitNotice('Successfully logged in.');
    }

    async startFetchingBookmarks() {
        await this.pageManager.goToBookmarksPage();

        // TODO allow user to retry (by refreshing the page and waiting for the req/res pair again)
        const config = await this.createBookmarksRequesterConfig();
        if(config)
            this.startBookmarksRequesterWorker(config);
    }

    protected async createBookmarksRequesterConfig(): Promise<BookmarksRequester.Config | undefined> {
        const bookmarksPathnameRegex = Twitter.Url.PATH_REGEXES.bookmarks;
        const [req, res] = await Promise.all([
            this.pageManager.waitForRequest(bookmarksPathnameRegex),
            this.pageManager.waitForResponse(bookmarksPathnameRegex)
        ]);

        const reqHeader = <Twitter.Api.RequestHeader> (req!.headers() as unknown);
        const reqUrl = new URL(req!.url());

        const resBody = <Twitter.Api.Response> await res.json();
        const resBodyAsError = <Twitter.Api.ErrorResponse> resBody;
        if(resBodyAsError.errors) {
            const errorMessage = resBodyAsError.errors[0].message;
            this.emitInternalError(`Unable to fetch bookmarks. Reason given by Twitter: ${errorMessage}`);
            return;
        }

        const dataExtractor = new DataExtractor(<Twitter.Api.SuccessResponse> resBody);
        const initialCursor = dataExtractor.cursor.bottom;
        const initialBookmarks = dataExtractor.tweets;
        return {
            reqUrl,
            reqHeader,
            initialCursor,
            initialBookmarks
        };
    }

    protected startBookmarksRequesterWorker(config: BookmarksRequester.Config) {
        // const boilerplate = [
        //     'require("tsconfig-paths/register")',
        //     'require("ts-node/register")',
        //     'require(require("worker_threads").workerData.sourceFile)'
        // ].join('\r\n');

        // this.bookmarksRequesterWorker = new Worker(boilerplate, {
        //     eval: true,
        //     workerData: {
        //         ...config,
        //         sourceFile: './bookmarks-requester-thread.ts'
        //     }
        // });

        // this.bookmarksRequesterWorker.on('message', () => {});
        // this.bookmarksRequesterWorker.on('error', () => {});
        // this.bookmarksRequesterWorker.on('exit', () => {});
    }

    protected async stopBookmarksRequesterWorker() {
        //this.bookmarksRequesterWorker?.postMessage('stop');
    }

    async logOut() {
        if(this.notReady)
            return;

        await this.pageManager.logOut();

        if(this.pageManager.currentUrlHasPath(Twitter.Url.PATHNAMES.loggedOut)) {
            this.state = State.LoggedOut;
            return;
        }

        //throw new Error('Logout failed.');
    }

    async shutDown() {
        if(this.loggedIn)
            await this.logOut();

        await this.pageManager.tearDown();
        await this.db.shutDown();
        this.state = State.NotReady;
    }
}
