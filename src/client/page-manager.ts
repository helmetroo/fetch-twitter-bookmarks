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

    currentUrlHasPath(path: string) {
        const currentUrl = new URL(this.curPage!.url());
        return currentUrl.pathname === path;
    }

    waitForRequest(pathnameRegex: RegExp) {
        return this.curPage!.waitForRequest(pathnameRegex);
    }

    waitForResponse(pathnameRegex: RegExp) {
        return this.curPage!.waitForResponse(pathnameRegex);
    }

    async logIn(credentials: Credentials) {
        const {
            usernameInput,
            passwordInput,
            submitButton
        } = Twitter.Selectors.LOGIN_PAGE;

        await this.curPage?.goto(Twitter.Url.LOGIN);
        await this.curPage?.type(usernameInput, credentials.username);
        await this.curPage?.type(passwordInput, credentials.password);
        await this.curPage?.click(submitButton);
        await this.curPage?.waitForNavigation();
    }

    async enterConfirmationCode(code: string) {
        const {
            codeInput,
            submitButton
        } = Twitter.Selectors.CONFIRMATION_CODE_PAGE;

        await this.curPage?.type(codeInput, code);
        await this.curPage?.click(submitButton);
    }

    // TODO only keep if these pages are drastically different. If not, should refactor
    async enterTwoFactorCode(code: string) {
        const {
            codeInput,
            submitButton
        } = Twitter.Selectors.CONFIRMATION_CODE_PAGE;

        await this.curPage?.type(codeInput, code);
        await this.curPage?.click(submitButton);
    }

    async goToBookmarksPage() {
        await this.curPage?.goto(Twitter.Url.BOOKMARKS, {
            waitUntil: 'domcontentloaded'
        });
    }

    async logOut() {
        await this.curPage?.goto(Twitter.Url.LOGOUT);
        await this.curPage?.click(Twitter.Selectors.LOGOUT_PAGE.confirmButton);
    }

    async tearDown() {
        if(!this.browser)
            return;

        await this.browser.close();
        this.browser = undefined;
    }
}
