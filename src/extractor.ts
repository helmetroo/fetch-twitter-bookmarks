import { EventEmitter } from 'events';
import { parse as urlParse } from 'url';

import { Browser, ElementHandle, Page } from 'puppeteer';
import { OrderedSet, Map, List, fromJS } from 'immutable';
import { get } from 'lodash';

import Tweet, { TweetLinks, TweetMedia } from './interfaces/tweet';
import TweetMap, { TweetMapHashCode, TweetMapEquals } from './interfaces/tweet-map';
import TwitterBookmarksExtractorOptions from './interfaces/extractor-options';
import UsernamePasswordCredentials from './interfaces/username-password-credentials';
import CredentialFields from './interfaces/credential-fields';
import ProgressEventEmitter from './interfaces/progress-event-emitter';
import EventCompleteRatio from './interfaces/event-complete-ratio';
import Maybe, { isNil } from './interfaces/maybe';

class TwitterBookmarksExtractor extends ProgressEventEmitter {
    public static readonly PAGE_NEW: string = 'extractor:page:new';
    public static readonly TWITTER_PAGE: string = 'extractor:page:load-twitter';
    public static readonly LOGIN: string = 'extractor:page:login';
    public static readonly BOOKMARKED_TWEETS_PAGE: string = 'extractor:page:load-bookmarks';
    public static readonly BOOKMARKED_TWEETS_EXTRACTION: string = 'extractor:tweets:extraction';
    public static readonly BOOKMARKED_TWEETS_EXTRACT_COMPLETE: string = 'extractor:tweets:complete';

    public static readonly PROGRESS_EVENTS: string[] = [
        TwitterBookmarksExtractor.PAGE_NEW,
        TwitterBookmarksExtractor.TWITTER_PAGE,
        TwitterBookmarksExtractor.LOGIN,
        TwitterBookmarksExtractor.BOOKMARKED_TWEETS_PAGE,
        TwitterBookmarksExtractor.BOOKMARKED_TWEETS_EXTRACTION,
        TwitterBookmarksExtractor.BOOKMARKED_TWEETS_EXTRACT_COMPLETE,
    ];

    protected browser: Browser;
    protected credentials: UsernamePasswordCredentials;

    protected bookmarksPage: Page | null = null;

    constructor(
        protected options: TwitterBookmarksExtractorOptions
    ) {
        super();

        this.browser = options.browser;
        this.credentials = options.credentials;
    }

    public getBookmarksPage() {
        return Maybe.fromValue(this.bookmarksPage);
    }

    public async extract() {
        // Must get to at least the bookmarks page before returning anything
        try {
            const newPage = (this.options.newTab)
                ? await this.browser.newPage()
                : (await this.browser.pages())[0];
            this.emitProgressEvent(TwitterBookmarksExtractor.PAGE_NEW);

            this.bookmarksPage =
                await this.resolveBookmarksPage(newPage, !this.options.newTab);
        } catch(err) {
            // TODO wrap original err in the one below; create separate error classes
            const bookmarksUnavailableErr = new Error(`Couldn't open Twitter bookmarks page.`);
            throw bookmarksUnavailableErr;
        }

        let tweets: Tweet[] = [];
        try {
            await this.bookmarksPage.waitForSelector('article');
        } catch(err) {
            this.emitMessageEvent(
                'Unable to fetch tweets. Could not find any <article /> containers which contain tweets.'
            )

            return tweets;
        }

        try {
            tweets =
                await this.extractTweetsFromPage(this.bookmarksPage);

            this.emitProgressEvent(
                TwitterBookmarksExtractor.BOOKMARKED_TWEETS_EXTRACT_COMPLETE
            );
        } catch(err) {}

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

        this.emitProgressEvent(TwitterBookmarksExtractor.BOOKMARKED_TWEETS_PAGE);
        return page;
    }

    protected async goToLoginPageAndLogin(page: Page, goToLogin = true) {
        if(goToLogin) {
            await page.goto('https://mobile.twitter.com/login');
            this.emitProgressEvent(TwitterBookmarksExtractor.TWITTER_PAGE);
        }

        await TwitterBookmarksExtractor.login(page, this.credentials);
        this.emitProgressEvent(TwitterBookmarksExtractor.LOGIN);
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
            await TwitterBookmarksExtractor.getLoginFormFields(loginForm);
        await maybeLoginFormFields.mapAsync(async (loginFormFields) => {
            const {
                usernameField,
                passwordField
            } = loginFormFields;

            const {
                username,
                password
            } = credentials;

            await TwitterBookmarksExtractor
                .enterCredentialInField(username, usernameField);
            await TwitterBookmarksExtractor
                .enterCredentialInField(password, passwordField);

            const submitButton = await loginForm.$('[role="button"]');
            if(!submitButton)
                throw new Error('Unable to login. Cannot find login button.');
            try {
                await submitButton.click();
            } catch(err) {
                throw new Error('Unable to login. Cannot find login button.');
            }

            await twitterLogin.waitForNavigation();

            const currentUrl = twitterLogin.url();
            const loginFailed = currentUrl
                .includes('https://mobile.twitter.com/login/error');
            if(loginFailed)
                throw new Error('Incorrect credentials.');
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

    protected async extractTweetsFromPage(bookmarks: Page) {
        let tweets: OrderedSet<TweetMap> = OrderedSet();
        const definedMaxLimit =
            this.options.maxLimit !== Number.POSITIVE_INFINITY;

        while(true) {
            const tweetContainers = await bookmarks.$$('article');
            if(tweetContainers.length === 0)
                break;

            const extractedTweets =
                await this.extractTweetsFromContainers(tweetContainers);
            const extractedTweetsSet = OrderedSet(extractedTweets);
            tweets = tweets.union(extractedTweetsSet);

            if(definedMaxLimit)
                this.emitTweetExtractionProgressEvent(tweets.size);

            const reachedLimit =
                (tweets.size >= this.options.maxLimit);
            if(reachedLimit) 
                break;

            const continueScrolling =
                await this.scrollForMoreTweets(bookmarks);
            if(!continueScrolling)
                break;
        }

        if(!definedMaxLimit) {
            this.emitProgressEvent(
                TwitterBookmarksExtractor.BOOKMARKED_TWEETS_EXTRACTION
            );
        }

        const tweetsArray =
            TwitterBookmarksExtractor.tweetMapsToTweets(tweets, this.options.maxLimit);
        return tweetsArray;
    }

    protected async extractTweetsFromContainers(tweetContainers: ElementHandle<Element>[]) {
        let extractedTweets: List<TweetMap> = List();
        for(const container of tweetContainers) {
            const tweetToAdd =
                await this.extractTweetFromContainer(container);

            const tweetMap = <TweetMap> Map(fromJS(tweetToAdd));
            tweetMap.hashCode = TweetMapHashCode;
            tweetMap.equals = TweetMapEquals;
            extractedTweets = extractedTweets.push(tweetMap);
        }

        return extractedTweets;
    }

    protected async extractTweetFromContainer(articleContainer: ElementHandle<Element>) {
        const articleTweet = await articleContainer.$('div[data-testid="tweet"]');
        if(isNil(articleTweet)) {
            const noTweetContainer = new Error('Could not find tweet container for current tweet. Skipping...');
            throw noTweetContainer;
        }

        const links =
            await this.extractTweetLinks(articleTweet);

        const tweetUrl = urlParse(links.toTweet);
        const tweetId = Maybe.fromValue(tweetUrl.path)
            .map(path => path.split('/'))
            .map(splitPath => splitPath[splitPath.length - 1])
            .getOrElse('');

        const profileUrl = urlParse(links.toProfile);
        const profile = Maybe.fromValue(profileUrl.path)
            .getOrElse(' ').substr(1);

        const text =
            await this.extractTweetText(articleTweet);

        const media =
            await this.extractTweetMedia(articleTweet);

        const date =
            await this.extractTweetDate(articleTweet);

        const tweet: Tweet = {
            id: tweetId,
            profile,
            text,
            date,
            links,
            media
        };

        return tweet;
    }

    protected async extractTweetLinks(articleTweet: ElementHandle<Element>) {
        let toProfile = '';
        let toTweet = '';
        let embedded = '';

        try {
            const tweetHrefs =
                await articleTweet.$$eval(
                    'a',
                    links => links.map(link => (<HTMLAnchorElement> link).href)
                );

            toProfile = get(tweetHrefs, 0, '');
            toTweet = get(tweetHrefs, 2, '');
            embedded = get(tweetHrefs, 3, '');
        } catch(err) {}

        const tweetLinks: TweetLinks = {
            toProfile,
            toTweet,
            embedded
        };

        return tweetLinks;
    }

    protected async extractTweetText(articleTweet: ElementHandle<Element>) {
        let tweetTexts: string[] = [];
        try {
            const tweetTextContainer = await articleTweet.$('div[lang]');
            if(isNil(tweetTextContainer))
                return '';

            tweetTexts =
                await tweetTextContainer.$$eval(
                    'div[lang] > *',
                    TwitterBookmarksExtractor.createTextExtractor(),
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

    protected async extractTweetMedia(articleTweet: ElementHandle<Element>) {
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

    protected async extractTweetDate(articleTweet: ElementHandle<Element>) {
        let tweetDate = '';
        try {
            tweetDate = await articleTweet.$eval(
                'time',
                (timeElement) => (<HTMLTimeElement> timeElement).dateTime
            );
        } catch(err) {
            // TODO pass err
            this.emitMessageEvent('Unable to extract time from tweet.');
        }

        return tweetDate;
    }

    protected emitTweetExtractionProgressEvent(numTweetsCollected: number) {
        const extractionCompletionRatio: EventCompleteRatio = {
            complete: numTweetsCollected,
            total: this.options.maxLimit
        }

        this.emitProgressEvent(
            TwitterBookmarksExtractor.BOOKMARKED_TWEETS_EXTRACTION,
            extractionCompletionRatio
        );
    }

    protected async scrollForMoreTweets(bookmarks: Page) {
        let continueScrolling = false;

        try {
            const heightBeforeScroll =
                await bookmarks.evaluate(() => document.body.scrollHeight);

            const scrollProgress = await TwitterBookmarksExtractor
                .scrollDown(bookmarks);

            continueScrolling =
                await bookmarks.evaluate(({heightBeforeScroll, scrollProgress}) => {
                    const heightAfterScroll = document.body.scrollHeight;
                    const scrollHeightsChanged =
                        heightBeforeScroll !== heightAfterScroll;

                    const notReachedAfterScrollHeight =
                        scrollProgress < heightAfterScroll;

                    return scrollHeightsChanged || notReachedAfterScrollHeight;
                }, {
                    timeout: 2000
                }, {heightBeforeScroll, scrollProgress});
        } catch(err) {
            // TODO pass err
            this.emitMessageEvent('Ran into an issue scrolling for more tweets.');
        }

        return continueScrolling;
    }

    protected static async scrollDown(bookmarks: Page) {
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

    protected static tweetMapsToTweets(tweets: OrderedSet<TweetMap>, maxLimit: number) {
        const tweetMapsArray = tweets.toArray()
            .slice(0, maxLimit);

        const tweetsArray =
            tweetMapsArray.map(tweet => tweet.toObject() as unknown as Tweet);
        return tweetsArray;
    }
}

export default TwitterBookmarksExtractor;
