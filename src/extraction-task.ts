import { Page } from 'puppeteer';
import { OrderedSet } from 'immutable';
import { from, Subscription, Observer, Observable } from 'rxjs';
import { scan, takeWhile, switchMap } from 'rxjs/operators';

import Tweet from './interfaces/tweet';
import TweetSet from './interfaces/tweet-set';
import ProgressEventEmitter, {
    ProgressableEvent, ProgressEvent, MessageEvent
} from './interfaces/progress-event-emitter';
import Progressable from './interfaces/progressable';
import ErrorCallback from './interfaces/error-callback';
import PageManagerOptions from './interfaces/bookmarks-page-manager-options';
import TaskOptions from './interfaces/extractor-task-options';
import Maybe from './interfaces/maybe';
import EventCompleteRatio from './interfaces/event-complete-ratio';

import Extractor from './extractor';
import BookmarksPageManager from './bookmarks-page-manager';

import Exporter from './exporters/exporter';
import JSONExporter from './exporters/json';
import StdOutExporter from './exporters/std-out';

export default class ExtractionTask extends Progressable {
    public static readonly COMPLETE_MESSAGE: string = 'Finished extracting tweets.';
    public static readonly HALT_MESSAGE: string = 'Stopped extracting tweets.';

    public static readonly EXPORT_TWEETS: string = 'extractor:export:tweets';
    public static readonly BOOKMARKED_TWEETS_EXTRACTION: string = 'extractor:tweets:extraction';
    public static readonly BOOKMARKED_TWEETS_EXTRACT_COMPLETE: string = 'extractor:tweets:complete';

    public static readonly PROGRESS_EVENTS: string[] = [
        ExtractionTask.BOOKMARKED_TWEETS_EXTRACTION,
        ExtractionTask.BOOKMARKED_TWEETS_EXTRACT_COMPLETE,
        ExtractionTask.EXPORT_TWEETS
    ];

    protected bookmarksPageManager: BookmarksPageManager;
    protected extractor: Extractor;

    protected eventForwarder: Subscription = new Subscription();
    protected tweetStream: Subscription = new Subscription();

    protected tweets: TweetSet = OrderedSet();

    constructor(protected options: TaskOptions) {
        super();

        const {
            credentials,
            chromePath,
            manualQuit,
            inspect,
        } = this.options;

        const pageManagerOptions: PageManagerOptions = {
            credentials,
            chromePath,
            manualQuit,
            inspect,
        }

        this.bookmarksPageManager =
            new BookmarksPageManager(pageManagerOptions);

        this.extractor = new Extractor();

        this.pipeEventsFrom(this.bookmarksPageManager);
    }

    public get numEvents() {
        const pageManagerEvents =
            BookmarksPageManager.PROGRESS_EVENTS.length;

        let taskSpecificEvents =
            ExtractionTask.PROGRESS_EVENTS.length - 1;
        if(this.options.maxLimit !== Number.POSITIVE_INFINITY)
            taskSpecificEvents += this.options.maxLimit;

        const totalEvents =
            pageManagerEvents
            + taskSpecificEvents;

        return totalEvents;
    }

    public run() {
        const bookmarksPage$ =
            from(this.bookmarksPageManager.open());

        const tweets$ = bookmarksPage$.pipe(
            switchMap((page: Page) => <Observable<TweetSet>> this.extractor.extract(page)),
            scan((currentTweets: TweetSet, newTweets: TweetSet) => currentTweets.union(newTweets)),
            takeWhile((currentTweets: TweetSet) => currentTweets.size <= this.options.maxLimit, true)
        );

        const tweetsObserver: Observer<TweetSet> = {
            next: this.onExtractTweets.bind(this),
            error: this.onError.bind(this),
            complete: this.onComplete.bind(this)
        };

        this.tweetStream = tweets$.subscribe(tweetsObserver);
    }

    protected onExtractTweets(tweets: TweetSet) {
        this.tweets = tweets;

        const {
            maxLimit
        } = this.options;
        if(maxLimit === Number.POSITIVE_INFINITY)
            return;

        const numTweetsCollected = this.tweets.size;
        const extractionCompletionRatio: EventCompleteRatio = {
            complete: numTweetsCollected,
            total: maxLimit
        }

        this.emitProgressEvent(
            ExtractionTask.BOOKMARKED_TWEETS_EXTRACTION,
            extractionCompletionRatio
        );
    }

    protected onError(err: Error) {
        this.emitMessageEvent(err.message);

        Maybe.fromValue(err.stack)
            .map(stack => this.emitMessageEvent(stack));

        const errorCallback = this.options.errorCallback;
        return errorCallback(err);
    }

    protected onComplete() {
        const successCallback = this.options.successCallback;
        return successCallback();
    }

    public async stop(completed: boolean) {
        this.emitStopMessage(completed);
        this.stopForwardingEvents();
        this.stopStreamingTweets();

        if(completed)
            this.emitCompleteEvent();

        if(!this.tweets.isEmpty()) {
            // TODO look at appending to already existing file
            const tweetsArray = ExtractionTask.tweetMapsToTweets(this.tweets, this.options.maxLimit);

            const fileName = Maybe.fromValue(this.options.fileName);
            await fileName.mapAsync(fileName => this.exportTweets(tweetsArray, fileName));

            if(!this.options.silent)
                await ExtractionTask.printTweetsToStdOut(tweetsArray);
        }

        await this.bookmarksPageManager.close();
    }

    protected emitStopMessage(completed: boolean) {
        const message = (completed)
            ? ExtractionTask.COMPLETE_MESSAGE
            : ExtractionTask.HALT_MESSAGE;
        this.emitMessageEvent(message);
    }

    protected stopForwardingEvents() {
        this.eventForwarder.unsubscribe();
    }

    protected stopStreamingTweets() {
        this.tweetStream.unsubscribe();
    }

    protected emitCompleteEvent() {
        this.emitProgressEvent(
            ExtractionTask.BOOKMARKED_TWEETS_EXTRACT_COMPLETE
        );
    }

    protected static tweetMapsToTweets(tweets: TweetSet, maxLimit: number) {
        const tweetMapsArray = tweets.toArray()
            .slice(0, maxLimit);

        const tweetsArray =
            tweetMapsArray.map(tweet => tweet.toObject() as unknown as Tweet);
        return tweetsArray;
    }

    protected async exportTweets(tweets: Tweet[], fileName: string) {
        try {
            if(fileName) {
                const exporter: Exporter = new JSONExporter(fileName);
                await exporter.export(tweets);
            }

            this.emitProgressEvent(ExtractionTask.EXPORT_TWEETS);
        } catch(err) {
            this.emitMessageEvent('Failed to export tweets to file.');
        }
    }

    protected static async printTweetsToStdOut(tweets: Tweet[]) {
        const stdOutExporter = new StdOutExporter();
        await stdOutExporter.export(tweets);
    }
}
