import { EventEmitter } from 'events';
import { parse as urlParse } from 'url';

import { Browser, ElementHandle, Page } from 'puppeteer';
import { OrderedSet, Map, List, fromJS, hash } from 'immutable';

import UsernamePasswordCredentials from './interfaces/username-password-credentials';
import ProgressEventEmitter from './interfaces/progress-event-emitter';
import Maybe, { isNil } from './interfaces/maybe';

type CredentialFields = {
    usernameField: ElementHandle<Element>,
    passwordField: ElementHandle<Element>
}

interface Tweet {
    profile: string,
    text: string,
    date: string,
    links: TweetLinks,
    media: TweetMedia
}

interface TweetLinks {
    toProfile: string,
    toTweet: string,
    embedded: string | null
}

interface TweetMedia {
    images: string[],
    video: string | null
}

type TweetLinksMap = Map<string, string>;
type TweetMediaMap = Map<string, string | string[]>;
type TweetMap = Map<string, string | TweetLinksMap | TweetMediaMap>;
const TweetMapHashCode = function(this: TweetMap) {
    const tweetLink = <string> this.getIn(['links', 'toTweet']);
    return hash(tweetLink);
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
            await this.resolveBookmarksPage(newPage, !this.options.newTab);

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

        let tweets: OrderedSet<TweetMap> = OrderedSet();
        let canContinueScrolling = true;
        let lastHeight = 0;
        let page = 1;
        const definedLimit = (maxLimit !== Number.POSITIVE_INFINITY);
        while(true) {
            const tweetContainers = await bookmarks.$$('article');
            if(tweetContainers.length === 0)
                break;

            const extractedTweets =
                await TwitterBookmarkExtractor
                .extractTweetsFromContainers(tweetContainers);
            const extractedTweetsSet = OrderedSet(extractedTweets);
            tweets = tweets.union(extractedTweetsSet);

            const reachedLimit = definedLimit
                && (tweets.size >= maxLimit);
            if(reachedLimit) 
                break;

            lastHeight =
                await bookmarks.evaluate(() => document.body.scrollHeight);
            const newScrollProgress = await TwitterBookmarkExtractor
                .scrollForMoreTweets(bookmarks);
            const stopScrolling =
                await bookmarks.evaluate(({lastHeight, newScrollProgress}) => {
                    const newHeight = document.body.scrollHeight;
                    const heightsAreSame =
                        lastHeight === newHeight;

                    const progressMeetsOrExceedsHeight =
                        newScrollProgress >= newHeight;

                    return heightsAreSame && progressMeetsOrExceedsHeight;
                }, {
                    timeout: 2000
                }, {lastHeight, newScrollProgress});

            if(stopScrolling)
                break;

            ++page;
        }

        let tweetMapsArray = tweets.toArray();
        if(definedLimit)
            tweetMapsArray = tweetMapsArray.slice(0, maxLimit);

        const tweetsArray =
            tweetMapsArray.map(tweet => tweet.toObject() as unknown as Tweet);
        return tweetsArray;
    }

    protected static async extractTweetsFromContainers(tweetContainers: ElementHandle<Element>[]) {
        let extractedTweets: List<TweetMap> = List();
        for(const container of tweetContainers) {
            try {
                const tweetToAdd =
                    await TwitterBookmarkExtractor.extractTweetFromContainer(container);

                const tweetMap = <TweetMap> Map(fromJS(tweetToAdd));
                tweetMap.hashCode = TweetMapHashCode;
                extractedTweets = extractedTweets.push(tweetMap);
            } catch(err) {
                console.warn(err.message);
                continue;
            }
        }

        return extractedTweets;
    }

    protected static async extractTweetFromContainer(articleContainer: ElementHandle<Element>) {
        const articleTweet = await articleContainer.$('div[data-testid="tweet"]');
        if(isNil(articleTweet)) {
            const noTweetContainer = new Error('Could not find tweet container for current tweet. Skipping...');
            throw noTweetContainer;
        }

        const links =
            await TwitterBookmarkExtractor.extractTweetLinks(articleTweet);
        const profileUrl = urlParse(links.toProfile);
        const profile = Maybe.fromValue(profileUrl.path)
            .getOrElse(' ').substr(1);

        const text =
            await TwitterBookmarkExtractor.extractTweetText(articleTweet);

        const media =
            await TwitterBookmarkExtractor.extractTweetMedia(articleTweet);

        const date =
            await TwitterBookmarkExtractor.extractTweetDate(articleTweet);

        const tweet: Tweet = {
            profile,
            text,
            date,
            links,
            media
        };

        return tweet;
    }

    protected static async extractTweetLinks(articleTweet: ElementHandle<Element>): Promise<TweetLinks> {
        // TS treats return of $$eval as ElementHandle<string[]>, but we know this really gives us a string[]
        const tweetHrefs =
            await articleTweet.$$eval(
                'a',
                links => links.map(link => (<HTMLAnchorElement> link).href)
            );

        const [
            profileLink,
            _,
            tweetLink,
            embeddedLink
        ] = tweetHrefs;

        return {
            toProfile: profileLink || '',
            toTweet: tweetLink || '',
            embedded: embeddedLink || ''
        };
    }

    protected static async extractTweetText(articleTweet: ElementHandle<Element>) {
        let tweetTexts: string[] = [];
        try {
            const tweetTextContainer = await articleTweet.$('div[lang]');
            if(isNil(tweetTextContainer))
                return '';

            tweetTexts =
                await tweetTextContainer.$$eval(
                    'div[lang] > *',
                    TwitterBookmarkExtractor.createTextExtractor(),
                );
        } catch(err) {}

        const tweetText = tweetTexts.join('');
        return tweetText;
    }

    protected static createTextExtractor() {
        const textExtractor = (blocks: Element[]) =>
            blocks.map(
                (block: Element) => {
                    const textBlock = <HTMLElement> block;

                    const text = textBlock.textContent;
                    if(!text) {
                        const emojiTextDiv = textBlock.querySelector('div');
                        if(!emojiTextDiv)
                            return '';

                        const emojiText = emojiTextDiv.getAttribute('aria-label') || '';
                        return emojiText;
                    }

                    return text;
                }
            );

        return textExtractor;
    }

    protected static async extractTweetMedia(articleTweet: ElementHandle<Element>) {
        let tweetImageHrefs: string[] = [];
        try {
            tweetImageHrefs = await articleTweet.$$eval(
                '[alt="Image"]',
                links => links.map(link => (<HTMLImageElement> link).src)
            );
        } catch(err) {}

        let tweetVideoHref: string | null = null;
        try {
            tweetVideoHref = await articleTweet.$eval(
                'video',
                video => (<HTMLVideoElement> video).src
            );
        } catch(err) {}

        const tweetMedia: TweetMedia = {
            images: tweetImageHrefs,
            video: tweetVideoHref
        };

        return tweetMedia;
    }

    protected static async extractTweetDate(articleTweet: ElementHandle<Element>) {
        const tweetDate = await articleTweet.$eval(
            'time',
            (timeElement) => (<HTMLTimeElement> timeElement).dateTime
        );

        return tweetDate;
    }

    protected static async scrollForMoreTweets(bookmarks: Page) {
        return bookmarks.evaluate(() => {
            // We need to scroll only a bit at a time to catch all the elements.
            // We can't scroll by document.body.scrollHeight as we miss elements this way.
            // Is there a better way?
            const _window = <any> window;
            _window['te_currentScrollHeight'] = _window['te_currentScrollHeight'] || 0;

            _window['te_currentScrollHeight'] += 50;
            window.scrollTo(0, _window['te_currentScrollHeight']);

            return _window['te_currentScrollHeight'];
        });
    }
}

export default TwitterBookmarkExtractor;
