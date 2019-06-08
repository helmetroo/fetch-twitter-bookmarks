import { EventEmitter } from 'events';

import { Browser, ElementHandle, Page } from 'puppeteer';

import UsernamePasswordCredentials from '../interfaces/username-password-credentials';
import ProgressEventEmitter from '../interfaces/progress-event-emitter';
import Link from '../interfaces/link';
import Maybe, { isNil } from '../interfaces/maybe';

type CredentialFields = {
    usernameField: ElementHandle<any>,
    passwordField: ElementHandle<any>
}

interface Tweet {
    profile: string,
    tweet: string,
    link: string
}

function delay(timeout: number) {
    return new Promise((resolve) => {
        setTimeout(resolve, timeout);
    });
}

class TwitterExtractor extends ProgressEventEmitter {
    protected readonly PAGE_NEW: string = 'page:new';
    protected readonly TWITTER_PAGE: string = 'twitter:page';
    protected readonly PAGE_CLOSE: string = 'page:close';
    protected readonly LOGIN: string = 'login';
    protected readonly BOOKMARKED_TWEETS_PAGE: string = 'bookmarked-tweets:page';
    protected readonly BOOKMARKED_TWEETS_EXTRACT: string = 'bookmarked-tweets:extract';

    protected readonly PROGRESS_EVENTS: string[] = [
        this.PAGE_NEW,
        this.TWITTER_PAGE,
        this.PAGE_CLOSE,
        this.LOGIN,
        this.BOOKMARKED_TWEETS_PAGE,
        this.BOOKMARKED_TWEETS_EXTRACT
    ];

    constructor(
        protected browser: Browser,
        protected credentials: UsernamePasswordCredentials
    ) {
        super();
    }

    public async extract() {
        const [twitterLogin] = await this.browser.pages();
        this.emitProgressEvent(this.PAGE_NEW);

        await twitterLogin.goto('https://mobile.twitter.com/login');
        this.emitProgressEvent(this.TWITTER_PAGE);

        await this.login(twitterLogin);
        this.emitProgressEvent(this.LOGIN);

        await twitterLogin.goto('https://mobile.twitter.com/i/bookmarks');
        this.emitProgressEvent(this.BOOKMARKED_TWEETS_PAGE);

        await this.scrapeBookmarks(twitterLogin);
        this.emitProgressEvent(this.BOOKMARKED_TWEETS_EXTRACT);

        await this.browser.close();
        this.emitProgressEvent(this.PAGE_CLOSE);
    }

    protected static async getLoginFormFields(loginForm: ElementHandle<any>) {
        const usernameField = await loginForm.$('input[name="session[username_or_email]"]');
        if(isNil(usernameField))
            return Maybe.none<CredentialFields>();

        const passwordField = await loginForm.$('input[name="session[password]"]');
        if(isNil(passwordField))
            return Maybe.none<CredentialFields>();

        return Maybe.some({
            usernameField,
            passwordField
        });
    }

    protected async login(twitterLogin: Page) {
        const loginForm = await twitterLogin.waitForSelector('form[action="/sessions"]');

        const maybeLoginFormFields = await TwitterExtractor.getLoginFormFields(loginForm);
        await maybeLoginFormFields.mapAsync(async (loginFormFields) => {
            const {
                usernameField,
                passwordField
            } = loginFormFields;

            await this.enterCredentialInField(this.credentials.username, usernameField);
            await this.enterCredentialInField(this.credentials.password, passwordField);

            const submitButton = await loginForm.$('[role="button"]');
            await submitButton!.click();
            await twitterLogin.waitForNavigation();

            const currentUrl = twitterLogin.url();
            const loginFailed = currentUrl.includes('https://mobile.twitter.com/login/error');
            if(loginFailed) {
                throw new Error('Incorrect credentials.');
            }
        });
    }

    protected async enterCredentialInField(credential: string, credentialField: ElementHandle<any>) {
        await credentialField.focus();
        await credentialField.type(credential, {
            delay: 100
        });
    }

    protected async scrapeBookmarks(bookmarks: Page) {
        const tweetContainer = await bookmarks.waitForSelector('article');
        await this.extractTweetFromContainer(tweetContainer);
    }

    protected async extractTweetFromContainer(articleContainer: ElementHandle<any>) {
        const maybeArticleTweet = Maybe.fromValue(await articleContainer.$('div[data-testid="tweet"]'));
        await maybeArticleTweet.mapAsync(async (articleTweet) => {
            const tweetLinks =
                await articleTweet!.$$('a');

            const tweetHrefs =
                tweetLinks.map((link) => (link as unknown as Link).href);

            const [
                profileLink,
                _,
                tweetLink,
                embeddedLink
            ] = tweetHrefs;

            const tweet = {
                profile: profileLink,
                tweet: tweetLink,
                link: embeddedLink
            };

            console.log(tweet);
            return tweet;
        });
    }
}

export default TwitterExtractor;
