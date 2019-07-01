import puppeteer, {
    Browser,
    Page,
    ElementHandle,
    LaunchOptions as PuppeteerLaunchOptions
} from 'puppeteer';

import BookmarksPageProvider from './interfaces/bookmarks-page-provider';
import ValidUsernamePasswordCredentials from './interfaces/valid-username-password-credentials';
import PageProviderOptions from './interfaces/bookmarks-page-provider-options';
import LoginForm from './interfaces/login-form';
import Maybe from './interfaces/maybe';

export default class PuppeteerBookmarksPageProvider extends BookmarksPageProvider {
    protected async createBrowser() {
        return this.options.mapAsync(options => {
            return PuppeteerBookmarksPageProvider.tryCreateBrowser(options);
        });
    }

    protected static async tryCreateBrowser(options: PageProviderOptions) {
        const puppeteerLaunchOpts =
            this.getPuppeteerLaunchOptions(options);

        try {
            const browser = await puppeteer.launch(puppeteerLaunchOpts);
            return browser;
        } catch(err) {
            const noBrowserErr = new Error(`Fatal: couldn't start browser.`);
            throw noBrowserErr;
        }
    }

    protected async resolveBookmarksPage() {
        return this.options.mapAsync(async (options) => {
            const newTab = !options.chromePath;
            const bookmarksPage =
                await PuppeteerBookmarksPageProvider.loadBookmarksPage(
                    browser, options.credentials, newTab
                );

            return bookmarksPage;
        });
    }

    protected static getPuppeteerLaunchOptions(options: PageProviderOptions) {
        const {
            chromePath,
            manualQuit,
            inspect
        } = options;

        const handleSignals = !manualQuit;
        const puppeteerOptions: PuppeteerLaunchOptions = {
            headless: !inspect,
            defaultViewport: null,
            handleSIGINT: handleSignals,
            handleSIGTERM: handleSignals,
            handleSIGHUP: handleSignals
        };

        if(chromePath)
            puppeteerOptions.executablePath = chromePath;

        return puppeteerOptions;
    }

    protected static async loadBookmarksPage(
        browser: Browser,
        credentials: ValidUsernamePasswordCredentials,
        newTab: boolean
    ) {
        const newPage =
            await this.openNewPageOrTab(browser, newTab);

        const bookmarksOrLoginPage =
            await this.goToBookmarksPage(newPage);

        const bookmarksPage =
            await this.logInIfStillAtLoginPage(bookmarksOrLoginPage, credentials);

        return bookmarksPage;
    }

    protected static async openNewPageOrTab(
        browser: Browser,
        newTab: boolean
    ) {
        const newPage = (newTab)
            ? await browser.newPage()
            : (await browser.pages())[0];

        return newPage;
    }

    protected static async goToBookmarksPage(currentPage: Page) {
        await currentPage.goto('https://mobile.twitter.com/i/bookmarks', {
            waitUntil: 'networkidle2'
        });

        return currentPage;
    }

    protected static async logInIfStillAtLoginPage(
        currentPage: Page,
        credentials: ValidUsernamePasswordCredentials
    ) {
        const currentUrl = currentPage.url();
        const stillAtLogin =
            currentUrl.includes('https://mobile.twitter.com/login');
        if(stillAtLogin) {
            const bookmarksPage = await this.login(currentPage, credentials);
            return bookmarksPage;
        }

        return currentPage;
    }

    protected static async login(
        loginPage: Page,
        credentials: ValidUsernamePasswordCredentials
    ) {
        const loginForm =
            await this.getLoginForm(loginPage);

        return this
            .loginWithCredentials(loginPage, loginForm, credentials);
    }

    protected static async getLoginForm(currentPage: Page) {
        await currentPage.waitForSelector('form[action="/sessions"]');

        const usernameField = await currentPage
            .waitForSelector('input[name="session[username_or_email]"]');

        const passwordField = await currentPage
            .waitForSelector('input[name="session[password]"]');

        const submitButton = await currentPage
            .waitForSelector('div[role="button"]');

        const loginForm: LoginForm = {
            usernameField,
            passwordField,
            submitButton
        };

        return loginForm;
    }

    protected static async loginWithCredentials(
        loginPage: Page,
        loginForm: LoginForm,
        credentials: ValidUsernamePasswordCredentials
    ) {
        const {
            usernameField,
            passwordField,
            submitButton
        } = loginForm;

        const {
            username,
            password
        } = credentials;

        await this.enterCredentialInField(username, usernameField);
        await this.enterCredentialInField(password, passwordField);
        await submitButton.click();

        await loginPage.waitForNavigation();

        const currentUrl = loginPage.url();
        const loginFailed = currentUrl
            .includes('https://mobile.twitter.com/login/error');
        if(loginFailed) {
            // TODO allow user to retry their credentials if they don't work
            const incorrectCredsErr = new Error('Fatal: Incorrect credentials.');
            throw incorrectCredsErr;
        }

        return loginPage;
    }

    protected static async enterCredentialInField(
        credential: string,
        credentialField: ElementHandle<Element>
    ) {
        await credentialField.focus();
        await credentialField.type(credential, {
            delay: 20
        });
    }
}
