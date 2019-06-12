import { EventEmitter } from 'events';
import { parse as urlParse } from 'url';

import { Browser, ElementHandle, Page } from 'puppeteer';

import UsernamePasswordCredentials from './interfaces/username-password-credentials';
import ProgressEventEmitter from './interfaces/progress-event-emitter';
import Link from './interfaces/link';
import Maybe, { isNil } from './interfaces/maybe';

type CredentialFields = {
    usernameField: ElementHandle<Element>,
    passwordField: ElementHandle<Element>
}

interface Tweet {
    profile: string,
    text: string,
    links: TweetLinks,
    media: TweetMedia
}

interface TweetLinks {
    toProfile: string,
    toTweet: string,
    embedded?: string
}

interface TweetMedia {
    images: string[],
    video?: string
}

export interface TwitterExtractorOptions {
    maxLimit: number,
    newTab: boolean
}

class TwitterBookmarkExtractor extends ProgressEventEmitter {
    protected readonly PAGE_NEW: string = 'page:new';
    protected readonly TWITTER_PAGE: string = 'twitter:page';
    protected readonly LOGIN: string = 'login';
    protected readonly BOOKMARKED_TWEETS_PAGE: string = 'bookmarked-tweets:page';
    protected readonly BOOKMARKED_TWEETS_EXTRACT: string = 'bookmarked-tweets:extract';
    protected readonly BOOKMARKED_TWEETS_EXTRACT_COMPLETE: string = 'bookmarked-tweets:extract-complete';
    protected readonly FINISH = 'finish';

    protected readonly PROGRESS_EVENTS: string[] = [
        this.PAGE_NEW,
        this.TWITTER_PAGE,
        this.LOGIN,
        this.BOOKMARKED_TWEETS_PAGE,
        this.BOOKMARKED_TWEETS_EXTRACT,
        this.BOOKMARKED_TWEETS_EXTRACT_COMPLETE,
        this.FINISH
    ];

    protected bookmarksPage: Page | null = null;

    constructor(
        protected browser: Browser,
        protected credentials: UsernamePasswordCredentials,
        protected options: TwitterExtractorOptions
    ) {
        super();
    }

    public async extract() {
        const newPage = (this.options.newTab)
            ? await this.browser.newPage()
            : (await this.browser.pages())[0];
        this.emitProgressEvent(this.PAGE_NEW);

        this.bookmarksPage =
            await this.resolveBookmarksPage(newPage, this.options.newTab);

        const tweets =
            await TwitterBookmarkExtractor.extractTweetsFromPage(this.bookmarksPage!, this.options.maxLimit);
        this.emitProgressEvent(this.BOOKMARKED_TWEETS_EXTRACT_COMPLETE);

        return tweets;
    }

    protected async resolveBookmarksPage(page: Page, loginFirst: boolean) {
        if(loginFirst)
            await this.goToLoginPageAndLogin(page);

        await page.goto('https://mobile.twitter.com/i/bookmarks', {
            waitUntil: 'load'
        });
        const currentUrl = page.url();
        const stillAtLogin = currentUrl.includes('https://mobile.twitter.com/login');
        if(stillAtLogin)
            await this.goToLoginPageAndLogin(page, false);

        this.emitProgressEvent(this.BOOKMARKED_TWEETS_PAGE);
        return page;
    }

    protected async goToLoginPageAndLogin(page: Page, goToLogin = true) {
        if(goToLogin) {
            await page.goto('https://mobile.twitter.com/login');
            this.emitProgressEvent(this.TWITTER_PAGE);
        }

        await TwitterBookmarkExtractor.login(page, this.credentials);
        this.emitProgressEvent(this.LOGIN);
    }

    public async finish() {
        (this.options.newTab)
            ? isNil(this.bookmarksPage) ? undefined : await this.bookmarksPage.close()
            : await this.browser.close();

        this.emitProgressEvent(this.FINISH);
    }

    protected static async getLoginFormFields(loginForm: ElementHandle<Element>) {
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

        const maybeLoginFormFields =
            await TwitterBookmarkExtractor.getLoginFormFields(loginForm);
        await maybeLoginFormFields.mapAsync(async (loginFormFields) => {
            const {
                usernameField,
                passwordField
            } = loginFormFields;

            const {
                username,
                password
            } = credentials;

            await TwitterBookmarkExtractor
                .enterCredentialInField(username, usernameField);
            await TwitterBookmarkExtractor
                .enterCredentialInField(password, passwordField);

            const submitButton = await loginForm.$('[role="button"]');
            await submitButton!.click(); // Sometimes fails
            await twitterLogin.waitForNavigation();

            const currentUrl = twitterLogin.url();
            const loginFailed = currentUrl
                .includes('https://mobile.twitter.com/login/error');
            if(loginFailed) {
                throw new Error('Incorrect credentials.');
            }
        });
    }

    protected static async enterCredentialInField(
        credential: string,
        credentialField: ElementHandle<Element>
    ) {
        await credentialField.focus();
        await credentialField.type(credential, {
            delay: 100
        });
    }

    protected static async extractTweetsFromPage(bookmarks: Page, maxLimit: number) {
        try {
            await bookmarks.waitForSelector('article');
        } catch(err) {
            console.error('Unable to fetch tweets. Could not find any <article /> containers which contain tweets.');
            return <Tweet[]> [];
        }

        let tweets: Tweet[] = [];
        let canContinueScrolling = true;
        let lastMaxHeight = 0;
        let currentPage = 1;
        while(true) {
            const tweetContainers = await bookmarks.$$('article');
            if(tweetContainers.length === 0) {
                break;
            }

            await TwitterBookmarkExtractor
                .clearExtractedsFromBrowser(bookmarks, currentPage);

            const currentCollectedTweets =
                await TwitterBookmarkExtractor
                .extractTweetsFromContainers(tweetContainers);
            tweets = tweets.concat(currentCollectedTweets);

            const definedLimit = (maxLimit !== Number.POSITIVE_INFINITY);
            const reachedLimit = definedLimit
                && (tweets.length >= maxLimit);
            if(reachedLimit) {
                tweets = tweets.slice(0, maxLimit);
                break;
            }

            await TwitterBookmarkExtractor
                .markExtractedsFromBrowser(bookmarks, currentPage);

            lastMaxHeight =
                await bookmarks.evaluate(() => document.body.scrollHeight);
            const currentScrollProgress = await TwitterBookmarkExtractor
                .scrollForMoreTweets(bookmarks);
            const stopScrolling =
                await bookmarks.evaluate(({lastMaxHeight, currentScrollProgress}) => {
                    const currentMaxHeight = document.body.scrollHeight;
                    const currentMaxLessThanLast =
                        currentMaxHeight <= lastMaxHeight;

                    const currentHeightMoreThanCurrentMax =
                        currentScrollProgress >= currentMaxHeight;

                    return currentMaxLessThanLast && currentHeightMoreThanCurrentMax;
                }, {
                    timeout: 2000
                }, {lastMaxHeight, currentScrollProgress});

            if(stopScrolling)
                break;

            ++currentPage;
            await bookmarks.waitFor(1000);
        }

        return tweets;
    }

    protected static async extractTweetsFromContainers(tweetContainers: ElementHandle<Element>[]) {
        const currentCollectedTweets: Tweet[] = [];
        for(const container of tweetContainers) {
            try {
                const tweet =
                    await TwitterBookmarkExtractor.extractTweetFromContainer(container);
                currentCollectedTweets.push(tweet);
            } catch(err) {
                console.warn(err.message);
                continue;
            }
        }

        return currentCollectedTweets;
    }

    protected static async extractTweetFromContainer(articleContainer: ElementHandle<Element>) {
        const articleTweet = await articleContainer.$('div[data-testid="tweet"]');
        if(isNil(articleTweet)) {
            const noTweetContainer = new Error('Could not find tweet container for current tweet. Skipping...');
            throw noTweetContainer;
        }

        const tweetLinks =
            await TwitterBookmarkExtractor.extractTweetLinks(articleTweet);
        const profileUrl = urlParse(tweetLinks.toProfile);
        const profile = Maybe.fromValue(profileUrl.path)
            .getOrElse(' ').substr(1);

        const tweetText =
            await TwitterBookmarkExtractor.extractTweetText(articleTweet);

        const tweetMedia =
            await TwitterBookmarkExtractor.extractTweetMedia(articleTweet);

        const tweet: Tweet = {
            profile,
            links: tweetLinks,
            text: tweetText,
            media: tweetMedia
        };

        return tweet;
    }

    protected static async extractTweetLinks(articleTweet: ElementHandle<Element>): Promise<TweetLinks> {
        // TS treats return of $$eval as ElementHandle<string[]>, but we know this really gives us a string[]
        const tweetHrefs =
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

        return {
            toProfile: profileLink,
            toTweet: tweetLink,
            embedded: embeddedLink
        };
    }

    protected static async extractTweetText(articleTweet: ElementHandle<Element>) {
        let tweetTexts: string[] = [];
        try {
            tweetTexts =
                await articleTweet.$$eval(
                    'div[lang="en"] > span',
                    spans => spans.map(
                        span => {
                            const textSpan = (span as unknown as HTMLSpanElement);

                            const text = textSpan.textContent;
                            if(!text) {
                                const emojiDiv = Maybe.fromValue(textSpan.querySelector('div'));
                                const emojiText = emojiDiv
                                    .map(div => div.getAttribute('aria-label'))
                                    .getOrElse('');
                            }

                            return text;
                        }
                    )
                ) as unknown as string[];
        } catch(err) {}

        const tweetText = tweetTexts.join(' ');
        return tweetText;
    }

    protected static async extractTweetMedia(articleTweet: ElementHandle<Element>) {
        let tweetImageHrefs: string[] = [];
        try {
            tweetImageHrefs = await articleTweet.$$eval(
                '[alt="Image"]',
                links => links.map(link => (link as unknown as HTMLImageElement).src)
            ) as unknown as string[];
        } catch(err) {}

        let tweetVideoHref: string | undefined = undefined;
        try {
            tweetVideoHref = await articleTweet.$eval(
                'video',
                video => (video as unknown as HTMLVideoElement).src
            ) as unknown as string;
        } catch(err) {}

        const tweetMedia: TweetMedia = {
            images: tweetImageHrefs,
            video: tweetVideoHref
        };

        return tweetMedia;
    }

    protected static async clearExtractedsFromBrowser(bookmarks: Page, page: number) {
        const toBeErased = `REMOVEME_${page - 1}`;
        await bookmarks.$$eval(`.${toBeErased}`, (elementsToErase) => {
            elementsToErase.forEach(element => element.remove());
        });
    }

    protected static async markExtractedsFromBrowser(bookmarks: Page, page: number) {
        await bookmarks.evaluate(({ page }) => {
            const toBeMarked = `REMOVEME_${page}`;
            const articleElements = document.querySelectorAll('article');
            Array.from(articleElements).forEach(element => {
                element.className = toBeMarked;
            });
        }, { page });
    }

    protected static async scrollForMoreTweets(bookmarks: Page) {
        return bookmarks.evaluate(() => {
            // We need to scroll only a bit at a time to catch all the elements.
            // We can't scroll by document.body.scrollHeight as we miss elements this way.
            // Is there a better way?
            const _window = <any> window;
            _window['te_currentScrollHeight'] = _window['te_currentScrollHeight'] || 0;
            _window['te_currentScrollHeight'] += document.documentElement.clientHeight;
            window.scrollTo(0, _window['te_currentScrollHeight']);

            return _window['te_currentScrollHeight'];
        });
    }
}

export default TwitterBookmarkExtractor;
