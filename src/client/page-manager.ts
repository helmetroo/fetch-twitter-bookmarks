import { URL } from 'url';
import type { Browser, BrowserType, BrowserContext, Page } from 'playwright';

import { Twitter } from '../constants/twitter';
import Credentials from './credentials';

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

    get currentUrl() {
        return new URL(this.curPage!.url());
    }

    currentUrlHasPath(path: string) {
        return this.currentUrl.pathname === path;
    }

    currentUrlHasQueryParamSet(paramName: string) {
        const paramValue = this.currentUrl.searchParams.get(paramName);
        return paramValue === 'true';
    }

    waitForRequest(pathnameRegex: RegExp) {
        return this.curPage!.waitForRequest(pathnameRegex);
    }

    waitForResponse(pathnameRegex: RegExp) {
        return this.curPage!.waitForResponse(pathnameRegex);
    }

    protected async waitUntilDomLoaded() {
        await this.curPage?.waitForNavigation({
            waitUntil: 'domcontentloaded'
        });
    }

    async goToLogInPage() {
        await this.curPage?.goto(Twitter.Url.LOGIN);
    }

    async logIn(credentials: Credentials) {
        const {
            usernameInput,
            passwordInput,
            submitButton
        } = Twitter.Selectors.LOGIN_PAGE;

        await this.curPage?.type(usernameInput, credentials.username);
        await this.curPage?.type(passwordInput, credentials.password);
        await this.curPage?.click(submitButton);

        // Twitter redirects to / then /home, so domcontentloaded seems to be the best to wait for
        await this.waitUntilDomLoaded();
    }

    async enterAuthorizationCode(code: string) {
        const {
            codeInput,
            submitButton
        } = Twitter.Selectors.AUTHORIZATION_CODE_PAGE;

        await this.curPage?.type(codeInput, code);
        await this.curPage?.click(submitButton);
        await this.waitUntilDomLoaded();
    }

    async goToBookmarksPage() {
        await this.curPage?.goto(Twitter.Url.BOOKMARKS, {
            waitUntil: 'domcontentloaded'
        });
    }

    async logOut() {
        await this.curPage?.goto(Twitter.Url.LOGOUT);
        await this.curPage?.click(Twitter.Selectors.LOGOUT_PAGE.confirmButton);
        await this.waitUntilDomLoaded();
    }

    async tearDown() {
        if(!this.browser)
            return;

        await this.browser.close();
        this.browser = undefined;
    }
}
