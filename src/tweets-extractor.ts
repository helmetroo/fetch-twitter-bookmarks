import { parse as urlParse } from 'url';

import { ElementHandle, Page } from 'puppeteer';
import { OrderedSet, Map, List, fromJS } from 'immutable';
import { Observable, Subscriber, defer, pipe, from } from 'rxjs';
import { switchMap } from 'rxjs/operators';

import Selectors, { SelectorsObject } from './constants/selectors';
const {
    TweetArticle,
    Tweet,
    TweetId,
    TweetTime,
    TweetProfile,
    TweetEmbeddedLink,
    TweetText,
    TweetTextBlocks,
    TweetImage,
    TweetVideo,
    TwitterButton
} = Selectors;

import Tweet, { TweetLinks, TweetMedia } from './interfaces/tweet';
import TweetMap, { TweetMapHashCode, TweetMapEquals } from './interfaces/tweet-map';
import TweetSet from './interfaces/tweet-set';
import Maybe from './interfaces/maybe';

import extractText from './utils/extract-text';

export default class TweetsExtractor {
    public extract(bookmarks: Page) {
        const observableExtractor =
            new Observable<TweetSet>((subscriber: Subscriber<TweetSet>) => {
                const ensureContainers =
                    from(TweetsExtractor.ensureTweetContainersOnPage(bookmarks, subscriber));

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
            await bookmarks.waitForSelector(TweetArticle);
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
            const tweetContainers = await bookmarks.$$(TweetArticle);
            if(tweetContainers.length === 0) {
                subscriber.complete();
                break;
            }

            const extractedTweets =
                await TweetsExtractor.extractTweetsFromContainers(tweetContainers);
            const extractedTweetsSet = OrderedSet(extractedTweets);
            subscriber.next(extractedTweetsSet);

            const continueScrolling =
                await TweetsExtractor.scrollForMoreTweets(bookmarks);
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
        const tweetContainer = await articleContainer.$(Tweet);
        if(!tweetContainer)
            return null;

        let id: string;
        try {
            id = await this.extractTweetId(tweetContainer);
        } catch(err) {
            // Invalid tweet! ID must be defined.
            return null;
        }

        const date =
            await this.extractTweetDate(tweetContainer);

        const profile =
            await this.extractTweetProfile(tweetContainer);

        const text =
            await this.extractTweetText(tweetContainer);

        const media =
            await this.extractTweetMedia(tweetContainer);

        const embeddedLinkUrl =
            await this.extractEmbeddedTweetLink(tweetContainer);

        const profileUrl = `https://twitter.com/${profile}`;
        const tweetUrl = `https://twitter.com/${profile}/status/{id}`;
        const links: TweetLinks = {
            toProfile: profileUrl,
            toTweet: tweetUrl,
            embedded: embeddedLinkUrl
        };

        const tweet: Tweet = {
            id,
            date,
            profile,
            text,
            media,
            links,
        };

        return tweet;
    }

    protected static async extractTweetId(tweetContainer: ElementHandle<Element>) {
        return tweetContainer.$eval(
            TweetId,
            link => {
                const href = (<HTMLAnchorElement> link).href;
                const hrefSplit = href.split('/');
                const id = hrefSplit[hrefSplit.length - 1];
                return id;
            }
        );
    }

    protected static async extractTweetDate(tweetContainer: ElementHandle<Element>) {
        let tweetDate = '';
        try {
            const foundTweetDate = await tweetContainer.$eval(
                TweetTime,
                timeElement => (<HTMLTimeElement> timeElement).dateTime
            );

            tweetDate = Maybe
                .fromValue(foundTweetDate)
                .getOrElse('');
        } catch(err) {}

        return tweetDate;
    }

    protected static async extractTweetProfile(tweetContainer: ElementHandle<Element>) {
        return tweetContainer.$eval(
            TweetProfile,
            link => {
                const href = (<HTMLAnchorElement> link).href;
                const profile = href.substr(1);
                return profile;
            }
        );
    }

    protected static async extractEmbeddedTweetLink(tweetContainer: ElementHandle<Element>) {
        try {
            return tweetContainer.$eval(
                TweetEmbeddedLink,
                link => (<HTMLAnchorElement> link).href
            );
        } catch(err) {
            return null;
        }
    }

    protected static async extractTweetText(tweetContainer: ElementHandle<Element>) {
        const tweetTextContainer = await tweetContainer.$(TweetText);
        const tweetTextsFetch = await Maybe.fromValue(tweetTextContainer)
            .mapAsync(async (container) => {
                return container.$$eval(
                    TweetTextBlocks,
                    extractText
                );
            });

        const tweetTexts = tweetTextsFetch.getOrElse(<string[]> []);
        const tweetText = tweetTexts.join('');
        return tweetText;
    }

    protected static async extractTweetMedia(tweetContainer: ElementHandle<Element>) {
        const tweetImageHrefs = await tweetContainer.$$eval(
            TweetImage,
            links => links.map(link => (<HTMLImageElement> link).src)
        );

        let tweetVideoHref: string | null = null;
        try {
            tweetVideoHref = await tweetContainer.$eval(
                TweetVideo,
                video => (<HTMLVideoElement> video).src
            );
        } catch(err) {}

        const tweetMedia: TweetMedia = {
            images: tweetImageHrefs,
            video: tweetVideoHref
        };

        return tweetMedia;
    }

    protected static async scrollForMoreTweets(bookmarks: Page) {
        let continueScrolling = false;

        try {
            continueScrolling =
                await bookmarks.evaluate(async (selectors: SelectorsObject) => {
                    const {
                        TweetArticle,
                        TwitterButton
                    } = selectors;

                    const scrollingElement = document.scrollingElement;
                    if(!scrollingElement)
                        return false;

                    const preScrollTop = scrollingElement.scrollTop;

                    const articleElements = document.querySelectorAll(TweetArticle);
                    const lastArticleElement = articleElements[articleElements.length - 1];
                    lastArticleElement.scrollIntoView();

                    await new Promise(res => setTimeout(res, 500));
                    const postScrollTop = scrollingElement.scrollTop;

                    const allButtons = document.querySelectorAll(TwitterButton);
                    const tryAgainButton = <HTMLElement | undefined>
                        Array.from(allButtons).filter(
                            elem => elem.textContent === 'Try again'
                        )[0];

                    if(tryAgainButton) {
                        tryAgainButton.click();
                        await new Promise(res => setTimeout(res, 500));
                        return true;
                    }

                    const notReachedEnd = Math.round(postScrollTop + window.innerHeight)
                        < scrollingElement.scrollHeight;

                    const scrolledDown = preScrollTop !== postScrollTop;

                    return notReachedEnd && scrolledDown;
                }, Selectors);
        } catch(err) {}

        return continueScrolling;
    }
}
