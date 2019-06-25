import puppeteer, {
    Browser,
    Page,
    ElementHandle,
    LaunchOptions as PuppeteerLaunchOptions
} from 'puppeteer';

import UsernamePasswordCredentials from './interfaces/username-password-credentials';
import ProgressEventEmitter from './interfaces/progress-event-emitter';
import PageManagerOptions from './interfaces/bookmarks-page-manager-options';
import LoginForm from './interfaces/login-form';
import Maybe from './interfaces/maybe';

export default class BookmarksPageManager extends ProgressEventEmitter {
    public static readonly CREATE_BROWSER: string = 'extractor:browser:create';
    public static readonly BOOKMARKED_TWEETS_PAGE: string = 'extractor:page:load-bookmarks';
    public static readonly CLOSE_BROWSER: string = 'extractor:browser:close';

    public static readonly PROGRESS_EVENTS: string[] = [
        BookmarksPageManager.CREATE_BROWSER,
        BookmarksPageManager.BOOKMARKED_TWEETS_PAGE,
        BookmarksPageManager.CLOSE_BROWSER
    ];

    protected launched: boolean = false;

    protected browser: Maybe<Browser> = Maybe.none<Browser>();
    protected bookmarksPage: Maybe<Page> = Maybe.none<Page>();

    constructor(
        protected options: PageManagerOptions
    ) {
        super();
    }

    public async open() {
        const browser = await BookmarksPageManager.tryCreateBrowser(this.options);
        this.browser = Maybe.fromValue(browser);
        this.emitProgressEvent(BookmarksPageManager.CREATE_BROWSER);
        this.launched = true;

        const newTab = !this.options.chromePath;
        const bookmarksPage =
            await BookmarksPageManager.resolveBookmarksPage(browser, this.options.credentials, newTab);
        this.bookmarksPage = Maybe.fromValue(bookmarksPage);
        this.emitProgressEvent(BookmarksPageManager.BOOKMARKED_TWEETS_PAGE);

        return bookmarksPage;
    }

    protected static async tryCreateBrowser(options: PageManagerOptions) {
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

    protected static getPuppeteerLaunchOptions(options: PageManagerOptions) {
        const {
            chromePath,
            manualQuit
        } = options;

        const handleSignals = !manualQuit;
        const puppeteerOptions: PuppeteerLaunchOptions = {
            defaultViewport: null,
            handleSIGINT: handleSignals,
            handleSIGTERM: handleSignals,
            handleSIGHUP: handleSignals
        };

        if(chromePath)
            puppeteerOptions.executablePath = chromePath;

        return puppeteerOptions;
    }

    protected static async resolveBookmarksPage(
        browser: Browser,
        credentials: UsernamePasswordCredentials,
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
        credentials: UsernamePasswordCredentials
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
        credentials: UsernamePasswordCredentials
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
        credentials: UsernamePasswordCredentials
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

    public async close() {
        try {
            if(!this.launched)
                return;

            const hasChromePath =
                !!this.options.chromePath;

            await (hasChromePath)
                ? BookmarksPageManager.closeBookmarksPage(this.bookmarksPage)
                : BookmarksPageManager.closeBrowser(this.browser);
        } catch(err) {
            this.emitMessageEvent('Failed to terminate browser properly.');
        } finally {
            this.emitProgressEvent(BookmarksPageManager.CLOSE_BROWSER);
        }
    }

    protected static async closeBrowser(browser: Maybe<Browser>) {
        await browser
            .mapAsync(async (browser) => await browser.close());
    }

    protected static async closeBookmarksPage(bookmarksPage: Maybe<Page>) {
        await bookmarksPage
            .mapAsync(async (page) => await page.close());
    }
}
