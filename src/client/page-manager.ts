import { URL } from 'url';
import { stringify } from 'querystring';

import { Browser, BrowserType, BrowserContext, Page } from 'playwright';

import Credentials from './credentials';

export const PATHNAMES = {
    loggedOut: '/',
    logIn: '/login',
    logInError: '/login/error',
    logOut: '/logout',
    bookmarks: '/i/bookmarks',
    challengeCode: '/account/login_challenge',
    twoFaCode: '/account/2fa_challenge', // TODO probably NOT correct path!!!
};

const TWITTER_URL = 'https://twitter.com';

function buildTwitterUrlWithOpts(def: Partial<URL>) {
    const twitterUrlDef = new URL(TWITTER_URL);
    Object.assign(twitterUrlDef, def);

    return twitterUrlDef.toString();
}

const BOOKMARKS_REDIRECT_SEARCH_PARAMS = stringify({
    redirect_after_login: PATHNAMES.bookmarks
});

const LOGIN_URL_WITH_BOOKMARKS_REDIRECT = buildTwitterUrlWithOpts({
    pathname: PATHNAMES.logIn,
    search: BOOKMARKS_REDIRECT_SEARCH_PARAMS
});

const LOGOUT_URL = buildTwitterUrlWithOpts({
    pathname: PATHNAMES.logOut
});

const LOGIN_PAGE_SELECTORS = {
    usernameInput: 'input[name="session[username_or_email]"]',
    passwordInput: 'input[name="session[password]"]',
    submitButton: 'div[data-testid="LoginForm_Login_Button"]'
};

const CONFIRMATION_CODE_PAGE_SELECTORS = {
    codeInput: 'input[name="challenge_response"]',
    submitButton: 'input[type="submit"]'
};

const LOGOUT_PAGE_SELECTORS = {
    confirmButton: 'div[data-testid="confirmationSheetConfirm"]'
};

export default class PageManager {
    protected active: boolean = false;
    protected browserType?: BrowserType;
    protected browser?: Browser;
    protected browserContext?: BrowserContext;
    protected curPage?: Page;

    setBrowserType(browserType: BrowserType) {
        this.browserType = browserType;
    }

    async init() {
        this.browser = await this.browserType!.launch();
        this.browserContext = await this.browser.newContext();
        this.curPage = await this.browserContext.newPage();

        this.active = true;
    }

    currentUrlHasPath(path: string) {
        const currentUrl = new URL(this.curPage!.url());
        return currentUrl.pathname === path;
    }

    async refreshWithBookmarksRedirect() {
        const currentUrl = new URL(this.curPage!.url());
        currentUrl.search = BOOKMARKS_REDIRECT_SEARCH_PARAMS;
        await this.curPage!.goto(currentUrl.toString());
    }

    async logIn(credentials: Credentials) {
        const {
            usernameInput,
            passwordInput,
            submitButton
        } = LOGIN_PAGE_SELECTORS;

        await this.curPage!.goto(LOGIN_URL_WITH_BOOKMARKS_REDIRECT);
        await this.curPage!.type(usernameInput, credentials.username);
        await this.curPage!.type(passwordInput, credentials.password);
        await this.curPage!.click(submitButton);
    }

    async enterConfirmationCode(code: string) {
        const {
            codeInput,
            submitButton
        } = CONFIRMATION_CODE_PAGE_SELECTORS;

        await this.curPage!.type(codeInput, code);
        await this.curPage!.click(submitButton);
    }

    // TODO only keep if these pages are drastically different. If not, should refactor
    async enterTwoFactorCode(code: string) {
        const {
            codeInput,
            submitButton
        } = CONFIRMATION_CODE_PAGE_SELECTORS;

        await this.curPage!.type(codeInput, code);
        await this.curPage!.click(submitButton);
    }

    async logOut() {
        await this.curPage!.goto(LOGOUT_URL);
        await this.curPage!.click(LOGOUT_PAGE_SELECTORS.confirmButton);
    }

    async tearDown() {
        if(!this.browser)
            return;

        await this.browser.close();
        this.browser = undefined;
    }
}
