import { parse as urlParse } from 'url';

import { ElementHandle, Page } from 'puppeteer';
import { OrderedSet, Map, List, fromJS } from 'immutable';
import { Observable, Subscriber, defer, pipe, from } from 'rxjs';
import { switchMap } from 'rxjs/operators';

import Tweet, { TweetLinks, TweetMedia } from './interfaces/tweet';
import TweetMap, { TweetMapHashCode, TweetMapEquals } from './interfaces/tweet-map';
import TweetSet from './interfaces/tweet-set';
import Maybe from './interfaces/maybe';

class TwitterBookmarksExtractor {
    public extract(bookmarks: Page) {
        const observableExtractor =
            new Observable<TweetSet>((subscriber: Subscriber<TweetSet>) => {
                const ensureContainers =
                    from(TwitterBookmarksExtractor.ensureTweetContainersOnPage(bookmarks, subscriber));

                const thenExtractTweets =
                    switchMap(() => this.extractTweetsFromPage(bookmarks, subscriber));

                const extractProcess =
                    ensureContainers.pipe(
                        thenExtractTweets
                    ).subscribe();

                return () => extractProcess.unsubscribe();
            });

        return observableExtractor;
    }

    protected static async ensureTweetContainersOnPage(bookmarks: Page, subscriber: Subscriber<TweetSet>) {
        try {
            await bookmarks.waitForSelector('article');
        } catch(err) {
            // TODO wrap original err in the one below; create separate error classes
            const noTweetsAvailableErr = new Error(
                `Fatal: Unable to fetch tweets. Couldn't find any <article /> containers which contain tweets.`
            );

            subscriber.error(noTweetsAvailableErr);
        }
    }

    protected async extractTweetsFromPage(bookmarks: Page, subscriber: Subscriber<TweetSet>) {
        while(true) {
            const tweetContainers = await bookmarks.$$('article');
            if(tweetContainers.length === 0) {
                subscriber.complete();
                break;
            }

            const extractedTweets =
                await TwitterBookmarksExtractor.extractTweetsFromContainers(tweetContainers);
            const extractedTweetsSet = OrderedSet(extractedTweets);
            subscriber.next(extractedTweetsSet);

            const continueScrolling =
                await TwitterBookmarksExtractor.scrollForMoreTweets(bookmarks);
            if(!continueScrolling) {
                subscriber.complete();
                break;
            }
        }
    }

    protected static async extractTweetsFromContainers(tweetContainers: ElementHandle<Element>[]) {
        let extractedTweets: List<TweetMap> = List();

        for(const container of tweetContainers) {
            const tweetToAdd =
                await this.extractTweetFromContainer(container);

            if(tweetToAdd) {
                const tweetMap = <TweetMap> Map(fromJS(tweetToAdd));
                tweetMap.hashCode = TweetMapHashCode;
                tweetMap.equals = TweetMapEquals;
                extractedTweets = extractedTweets.push(tweetMap);
            }
        }

        return extractedTweets;
    }

    protected static async extractTweetFromContainer(articleContainer: ElementHandle<Element>) {
        const tweetContainer = await articleContainer.$('div[data-testid="tweet"]');
        if(!tweetContainer)
            return null;

        // TODO Critical info about the tweet (id, profile) comes from here
        // We may want to discard this tweetContainer if we can't extract this information
        const links =
            await this.extractTweetLinks(tweetContainer);

        const tweetUrl = urlParse(links.toTweet);
        const tweetId = Maybe.fromValue(tweetUrl.path)
            .map(path => path.split('/'))
            .map(splitPath => splitPath[splitPath.length - 1])
            .getOrElse('');

        const profileUrl = urlParse(links.toProfile);
        const profile = Maybe.fromValue(profileUrl.path)
            .getOrElse(' ').substr(1);

        const text =
            await this.extractTweetText(tweetContainer);

        const media =
            await this.extractTweetMedia(tweetContainer);

        const date =
            await this.extractTweetDate(tweetContainer);

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

    protected static async extractTweetLinks(articleTweet: ElementHandle<Element>) {
        const tweetHrefs =
            await articleTweet.$$eval(
                'a',
                links => links.map(link => (<HTMLAnchorElement> link).href)
            );

        const toProfile = Maybe
            .fromValue(tweetHrefs[0])
            .getOrElse('');

        const toTweet = Maybe
            .fromValue(tweetHrefs[2])
            .getOrElse('');

        const embedded: string | null =
            tweetHrefs[3] || null;

        const tweetLinks: TweetLinks = {
            toProfile,
            toTweet,
            embedded
        };

        return tweetLinks;
    }

    protected static async extractTweetText(articleTweet: ElementHandle<Element>) {
        const tweetTextContainer = await articleTweet.$('div[lang]');
        const tweetTextsFetch = await Maybe.fromValue(tweetTextContainer)
            .mapAsync(async (container) => {
                return container.$$eval(
                    'div[lang] > *',
                    this.createTextExtractor(),
                );
            });

        const tweetTexts = tweetTextsFetch.getOrElse(<string[]> []);
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
        const tweetImageHrefs = await articleTweet.$$eval(
            '[alt="Image"]',
            links => links.map(link => (<HTMLImageElement> link).src)
        );

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
        let tweetDate = '';
        try {
            const foundTweetDate = await articleTweet.$eval(
                'time',
                (timeElement) => (<HTMLTimeElement> timeElement).dateTime
            );

            tweetDate = Maybe
                .fromValue(foundTweetDate)
                .getOrElse('');
        } catch(err) {}

        return tweetDate;
    }

    protected static async scrollForMoreTweets(bookmarks: Page) {
        let continueScrolling = false;

        try {
            continueScrolling =
                await bookmarks.evaluate(() => {
                    const heightBeforeScroll = document.body.scrollHeight;

                    // TODO For now this method works but perhaps we can make it faster?
                    const _window = <any> window;
                    _window['te_currentScrollHeight'] = _window['te_currentScrollHeight'] || 0;
                    _window['te_currentScrollHeight'] += 50;
                    window.scrollTo(0, _window['te_currentScrollHeight']);
                    const newScrollProgress = _window['te_currentScrollHeight'];

                    const heightAfterScroll = document.body.scrollHeight;
                    const scrollHeightsChanged =
                        heightBeforeScroll !== heightAfterScroll;

                    const notReachedAfterScrollHeight =
                        newScrollProgress < heightAfterScroll;

                    return scrollHeightsChanged || notReachedAfterScrollHeight;
                }, {
                    timeout: 2000
                });
        } catch(err) {}

        return continueScrolling;
    }
}

export default TwitterBookmarksExtractor;
