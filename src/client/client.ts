import { URL } from 'url';
import { writeFile } from 'fs';

import { BrowserType, chromium, firefox, webkit } from 'playwright';
import { TypedEmitter } from 'tiny-typed-emitter';

import { Twitter } from '../constants/twitter';
import Credentials from './credentials';
import PageManager from './page-manager';
import BookmarksRequester from './bookmarks-requester';

interface NameToBrowserType {
    [key: string]: BrowserType
};

const NAME_TO_BROWSER: NameToBrowserType = {
    'chromium': chromium,
    'firefox': firefox,
    'webkit': webkit
}

export enum State {
    Inactive,
    LoggedOut,
    Needs2FACode,
    NeedsConfirmationCode,
    LoggedIn
}

export interface ClientEvents {
    actionRequired: (message: string) => void;
    internalError: (message: string, ...rest: string[]) => void;
    userError: (message: string, ...rest: string[]) => void;
    success: () => void;
}

export type ClientEventKey = keyof ClientEvents;

export default class Client extends TypedEmitter<ClientEvents> {
    protected pageManager: PageManager;
    protected pageManagerReady: boolean = false;

    protected bookmarksRequester: BookmarksRequester;

    protected state: State = State.LoggedOut;
    protected lastAuthAttemptFailed: boolean = false;
    protected lastCodeAttemptFailed: boolean = false;

    get loggedOut() {
        return this.state === State.LoggedOut
            || this.needsConfirmationCode
            || this.needs2FACode
    }

    get loggedIn() {
        return this.state === State.LoggedIn;
    }

    get needsConfirmationCode() {
        return this.state === State.NeedsConfirmationCode;
    }

    get needs2FACode() {
        return this.state === State.Needs2FACode;
    }

    constructor() {
        super();

        this.pageManager = new PageManager();
        this.bookmarksRequester = new BookmarksRequester();
    }

    protected assertPageManagerReady() {
        const errorMessage = [
            'Page manager had not been initialized correctly.',
            'The page manager is necessary to sign in on your behalf to Twitter and begin the process of fetching bookmarks.'
        ].join('');

        if(!this.pageManagerReady)
            this.emit('internalError', errorMessage);
    }

    async init(browserName: string) {
        const browserType = NAME_TO_BROWSER[browserName];
        if(!browserType) {
            this.emit('userError', 'Please choose from "chromium", "webkit", or "firefox".');
            return;
        }

        this.pageManager.setBrowserType(browserType);
        await this.pageManager.init();
        this.pageManagerReady = true;
        this.emit('success');
    }

    async logIn(credentials: Credentials) {
        if(!this.pageManagerReady) {
            this.emit('internalError', `The browser hasn't been initialized yet.`);
            return;
        }

        this.lastAuthAttemptFailed = false;
        await this.pageManager.logIn(credentials);
        if(!this.pageManager.currentUrlHasPath(Twitter.Url.PATHNAMES.home))
            return this.handleLoginIssue();

        this.state = State.LoggedIn;
        this.emit('success');
    }

    protected async handleLoginIssue() {
        const {
            challengeCode,
            twoFaCode,
        } = Twitter.Url.PATHNAMES;

        if(this.pageManager.currentUrlHasPath(challengeCode)) {
            this.state = State.NeedsConfirmationCode;
            this.emit('actionRequired', 'Your confirmation code is necessary to proceed.');
        } else if(this.pageManager.currentUrlHasPath(twoFaCode)) {
            this.state = State.Needs2FACode;
            this.emit('actionRequired', 'Your 2FA code is necessary to proceed. Please check your device.');
        } else {
            this.lastAuthAttemptFailed = true;
            this.emit('userError', 'Your credentials were incorrect.');
        }
    }

    async enterConfirmationCode(code: string) {
        this.assertPageManagerReady();

        this.lastCodeAttemptFailed = false;
        await this.pageManager.enterConfirmationCode(code);
        if(this.pageManager.currentUrlHasPath(Twitter.Url.PATHNAMES.challengeCode)) {
            this.lastCodeAttemptFailed = true;
            this.emit('userError', 'Your challenge code was incorrect.');
        }
    }

    async enterTwoFactorCode(code: string) {
        this.assertPageManagerReady();

        this.lastCodeAttemptFailed = false;
        await this.pageManager.enterTwoFactorCode(code);
        if(this.pageManager.currentUrlHasPath(Twitter.Url.PATHNAMES.twoFaCode)) {
            this.lastCodeAttemptFailed = true;
            this.emit('userError', 'Your 2FA code was incorrect.');
        }
    }

    async startFetchingBookmarks() {
        await this.pageManager.goToBookmarksPage();
        await this.handleInitialBookmarksRequests();
        this.emit('success');
    }

    protected async handleInitialBookmarksRequests() {
        const bookmarksPathnameRegex = Twitter.Url.PATH_REGEXES.bookmarks;
        const [req, res] = await Promise.all([
            this.pageManager.waitForRequest(bookmarksPathnameRegex),
            this.pageManager.waitForResponse(bookmarksPathnameRegex)
        ]);

        const reqHeaders = <Twitter.Api.RequestHeader> (req!.headers() as unknown);
        const reqUrl = new URL(req!.url());
        const reqSearchParams = reqUrl.searchParams;

        const resBody = <Twitter.Api.Response> await res.json();
        const resBodyAsError = <Twitter.Api.ErrorResponse> resBody;
        if(resBodyAsError.errors) {
            const errorMessage = resBodyAsError.errors[0].message;
            this.emit('internalError', `Unable to fetch bookmarks. Reason given by Twitter: ${errorMessage}`);
            return;
        }

        this.bookmarksRequester.init(
            reqHeaders,
            reqSearchParams,
            <Twitter.Api.SuccessResponse> resBody
        );

        // To test what we have working so far
        const bookmarks = this.bookmarksRequester.bookmarks;
        const serializedBookmarks = JSON.stringify({ bookmarks });
        writeFile('./bookmarks.json', serializedBookmarks, 'utf8', _ => {});
    }

    async logOut(emitEvent: boolean = true) {
        if(!this.pageManagerReady)
            return;

        await this.pageManager.logOut();

        if(this.pageManager.currentUrlHasPath(Twitter.Url.PATHNAMES.loggedOut)) {
            this.state = State.LoggedOut;
            if(emitEvent)
                this.emit('success');
            return;
        }

        console.warn('Not at logged out page!');
        //throw new Error('Logout failed.');
    }

    async tearDown() {
        if(this.loggedIn)
            await this.logOut(false);

        await this.pageManager.tearDown();
        this.emit('success');
    }
}
