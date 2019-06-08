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

        await TwitterExtractor.login(twitterLogin, this.credentials);
        this.emitProgressEvent(this.LOGIN);

        await twitterLogin.goto('https://mobile.twitter.com/i/bookmarks', {
            waitUntil: 'load'
        });
        this.emitProgressEvent(this.BOOKMARKED_TWEETS_PAGE);

        await TwitterExtractor.extractTweetsFromPage(twitterLogin);
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

    protected static async login(twitterLogin: Page, credentials: UsernamePasswordCredentials) {
        const loginForm = await twitterLogin.waitForSelector('form[action="/sessions"]');

        const maybeLoginFormFields = await TwitterExtractor.getLoginFormFields(loginForm);
        await maybeLoginFormFields.mapAsync(async (loginFormFields) => {
            const {
                usernameField,
                passwordField
            } = loginFormFields;

            const {
                username,
                password
            } = credentials;

            await TwitterExtractor.enterCredentialInField(username, usernameField);
            await TwitterExtractor.enterCredentialInField(password, passwordField);

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

    protected static async enterCredentialInField(credential: string, credentialField: ElementHandle<any>) {
        await credentialField.focus();
        await credentialField.type(credential, {
            delay: 100
        });
    }

    protected static async extractTweetsFromPage(bookmarks: Page) {
        await bookmarks.waitForSelector('article');

        let tweets: (Tweet | null)[] = [];
        let previousHeight = 0;
        let canContinueScrolling = true;
        while(canContinueScrolling) {
            const existingArticles = await bookmarks.$$('article');
            const tweetExtractions =
                existingArticles.map(TwitterExtractor.extractTweetFromContainer);
            tweets = await Promise.all(tweetExtractions);

            previousHeight = await bookmarks.evaluate('document.body.scrollHeight');
            await bookmarks.evaluate('window.scrollTo(0, document.body.scrollHeight)');
            try {
                await bookmarks.waitForFunction(`document.body.scrollHeight > ${previousHeight}`);
            } catch(err) {
                canContinueScrolling = false;
                break;
            }

            await bookmarks.waitFor(1000);
        }

        tweets = tweets.reduce((collectedTweets, currentTweet) => {
            if(isNil(currentTweet))
                return collectedTweets;

            collectedTweets.push(currentTweet);
            return collectedTweets;
        }, <Tweet[]> []);
        return tweets;
    }

    protected static async extractTweetFromContainer(articleContainer: ElementHandle<any>) {
        const articleTweet = await articleContainer.$('div[data-testid="tweet"]');
        if(isNil(articleTweet))
            return null;

        // TS treats return of $$eval as ElementHandle<string[]>, but we know this really gives us a string[]
        const tweetHrefs: string[] =
            await articleTweet.$$eval(
                'a',
                links => links.map(link => (link as unknown as Link).href)
            ) as unknown as string[];

        const [
            profileLink,
            _,
            tweetLink,
            embeddedLink
        ] = tweetHrefs;

        const tweet: Tweet = {
            profile: profileLink,
            tweet: tweetLink,
            link: embeddedLink
        };

        console.log(tweet);
        return tweet;
    }
}

export default TwitterExtractor;
