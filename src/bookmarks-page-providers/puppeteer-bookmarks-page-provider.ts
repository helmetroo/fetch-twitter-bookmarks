import puppeteer, {
    Browser,
    Page,
    ElementHandle,
    LaunchOptions as PuppeteerLaunchOptions
} from 'puppeteer';

import BookmarksPageProvider from '@bookmarks-page-providers/bookmarks-page-provider';
import PuppeteerBookmarksPageProviderOptions from '@bookmarks-page-providers/puppeteer-bookmarks-page-provider-options';

import ValidUsernamePasswordCredentials from '@interfaces/valid-username-password-credentials';
import LoginForm from '@interfaces/login-form';
import Maybe from '@interfaces/maybe';

import LoginFormSelectors from '@constants/login-form-selectors';
const {
    LoginForm,
    LoginFormUsernameInput,
    LoginFormPasswordInput,
    LoginFormSubmit
} = LoginFormSelectors;

export default class PuppeteerBookmarksPageProvider extends BookmarksPageProvider {
    public readonly CREATE_BROWSER: string = 'extractor:browser:create';
    public readonly BOOKMARKED_TWEETS_PAGE: string = 'extractor:page:load-bookmarks';
    public readonly CLOSE_BROWSER: string = 'extractor:browser:close';

    public readonly PROGRESS_EVENTS: string[] = [
        this.CREATE_BROWSER,
        this.BOOKMARKED_TWEETS_PAGE,
        this.CLOSE_BROWSER
    ];

    protected launchedBrowser: boolean = false;
    protected browser: Maybe<Browser> = Maybe.none<Browser>();

    constructor(
        protected readonly options: PuppeteerBookmarksPageProviderOptions
    ) {
        super();
    }

    public async open() {
        const browser = await PuppeteerBookmarksPageProvider.tryCreateBrowser(this.options);
        this.browser = Maybe.fromValue(browser);
        this.emitProgressEvent(this.CREATE_BROWSER);
        this.launchedBrowser = true;

        const bookmarksPage =
            await PuppeteerBookmarksPageProvider.openBookmarksPage(browser, this.options);
        this.bookmarksPage = Maybe.fromValue(bookmarksPage);
        this.emitProgressEvent(this.BOOKMARKED_TWEETS_PAGE);

        return bookmarksPage;
    }

    protected static async tryCreateBrowser(options: PuppeteerBookmarksPageProviderOptions) {
        const puppeteerLaunchOpts =
            this.getPuppeteerLaunchOptions(options);

        try {
            const browser = await puppeteer.launch(puppeteerLaunchOpts);
            return browser;
        } catch(err) {
            // TODO custom error class that represents a fatal error
            const noBrowserErr = new Error(`Fatal: couldn't start browser.`);
            throw noBrowserErr;
        }
    }

    protected static getPuppeteerLaunchOptions(options: PuppeteerBookmarksPageProviderOptions) {
        const {
            chromePath,
            inspect
        } = options;

        const puppeteerOptions: PuppeteerLaunchOptions = {
            headless: !inspect,
            defaultViewport: null,
            handleSIGINT: true,
            handleSIGTERM: true,
            handleSIGHUP: true
        };

        if(chromePath)
            puppeteerOptions.executablePath = chromePath;

        return puppeteerOptions;
    }

    protected static async openBookmarksPage(
        browser: Browser,
        options: PuppeteerBookmarksPageProviderOptions
    ) {
        const newTab = !options.chromePath;
        const credentials = options.credentials;

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
        await currentPage.waitForSelector(LoginForm);

        const usernameField = await currentPage
            .waitForSelector(LoginFormUsernameInput);

        const passwordField = await currentPage
            .waitForSelector(LoginFormPasswordInput);

        const submitButton = await currentPage
            .waitForSelector(LoginFormSubmit);

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
            if(!this.launchedBrowser)
                return;

            const hasChromePath =
                !!this.options.chromePath;

            await (hasChromePath)
                ? PuppeteerBookmarksPageProvider.closeBookmarksPage(this.bookmarksPage)
                : PuppeteerBookmarksPageProvider.closeBrowser(this.browser);
        } catch(err) {
            this.emitMessageEvent('Failed to terminate browser properly.');
        } finally {
            this.emitProgressEvent(this.CLOSE_BROWSER);
        }
    }

    protected static async closeBrowser(browser: Maybe<Browser>) {
        await browser
            .mapAsync((browser) => browser.close());
    }

    protected static async closeBookmarksPage(bookmarksPage: Maybe<Page>) {
        await bookmarksPage
            .mapAsync((page) => page.close());
    }
}
