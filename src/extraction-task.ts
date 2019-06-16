import puppeteer, { Browser, LaunchOptions as PuppeteerLaunchOptions } from 'puppeteer';
import { isEmpty } from 'lodash';

import Tweet from './interfaces/tweet';
import Progressable from './interfaces/progressable';
import ErrorCallback from './interfaces/error-callback';

import TwitterBookmarksExtractor from './extractor';
import ExtractorOptions from './interfaces/extractor-options';
import TaskOptions from './interfaces/extractor-task-options';

import Exporter from './exporters/exporter';
import JSONExporter from './exporters/json';
import StdOutExporter from './exporters/std-out';

export default class ExtractionTask extends Progressable {
    public static readonly CREATE_BROWSER: string = 'extractor:browser:create';
    public static readonly CLOSE_BROWSER: string = 'extractor:browser:close';
    public static readonly EXPORT_TWEETS: string = 'extractor:export:tweets';

    public static readonly PROGRESS_EVENTS: string[] = [
        ExtractionTask.CREATE_BROWSER,
        ExtractionTask.CLOSE_BROWSER,
        ExtractionTask.EXPORT_TWEETS
    ];

    protected errorCallback: ErrorCallback;

    constructor(
        protected taskOptions: TaskOptions
    ) {
        super();
        this.errorCallback = taskOptions.errorCallback;
    }

    public get numEvents() {
        let extractorEvents = TwitterBookmarksExtractor.PROGRESS_EVENTS.length - 1;
        if(this.taskOptions.maxLimit !== Number.POSITIVE_INFINITY)
            extractorEvents += this.taskOptions.maxLimit;

        const taskSpecificEvents =
            ExtractionTask.PROGRESS_EVENTS.length;

        const totalEvents = extractorEvents + taskSpecificEvents;
        return totalEvents;
    }

    public async run() {
        const browser = await this.tryCreateBrowser();
        const extractor = this.createBookmarksExtractor(browser);

        this.forwardEvents(extractor);

        const tweets =
            await this.tryExtractTweets(extractor);
        await this.tryEndBrowserSession(browser, extractor);
        await this.exportTweets(tweets);

        this.stopForwardingEvents(extractor);

        this.printTweetsToStdOut(tweets);
    }

    protected async tryCreateBrowser() {
        const puppeteerLaunchOpts = this.getPuppeteerLaunchOptions();

        try {
            const browser = await puppeteer.launch(puppeteerLaunchOpts);
            return browser;
        } catch(err) {
            const noBrowserErr = new Error(`Couldn't start browser.`);
            return this.onError(noBrowserErr);
        }

        this.emitProgressEvent(ExtractionTask.CREATE_BROWSER);
    }

    protected getPuppeteerLaunchOptions() {
        const {
            chromePath
        } = this.taskOptions;

        const puppeteerOptions: PuppeteerLaunchOptions = {
            defaultViewport: null
        };

        if(chromePath)
            puppeteerOptions.executablePath = chromePath;

        return puppeteerOptions;
    }

    protected createBookmarksExtractor(browser: Browser) {
        const extractorOptions: ExtractorOptions = {
            credentials: this.taskOptions.credentials,
            browser,
            maxLimit: this.taskOptions.maxLimit,
            newTab: !isEmpty(this.taskOptions.chromePath)
        };

        const extractor = new TwitterBookmarksExtractor(extractorOptions);
        return extractor;
    }

    protected forwardEvents(extractor: TwitterBookmarksExtractor) {
        extractor.on('progress', this.forwardProgressEvent.bind(this));
        extractor.on('message', this.forwardMessageEvent.bind(this));
    }

    protected forwardProgressEvent(eventName: string, percentEventComplete?: number) {
        this.emit('progress', eventName, percentEventComplete);
    }

    protected forwardMessageEvent(message: string) {
        this.emit('message', message);
    }

    protected stopForwardingEvents(extractor: TwitterBookmarksExtractor) {
        extractor.off('progress', this.forwardProgressEvent.bind(this));
        extractor.off('message', this.forwardMessageEvent.bind(this));
    }

    protected async tryExtractTweets(extractor: TwitterBookmarksExtractor) {
        try {
            const tweets = await extractor.extract();
            return tweets;
        } catch(err) {
            const cantGetTweetsErr = new Error('Failed to extract tweets.');
            return this.onError(cantGetTweetsErr);
        }

        return <Tweet[]> [];
    }

    protected async tryEndBrowserSession(
        browser: Browser,
        extractor: TwitterBookmarksExtractor
    ) {
        const useChromeExecutable = !!this.taskOptions.chromePath;
        if(!useChromeExecutable) {
            try {
                await browser.close();
                this.emitProgressEvent(ExtractionTask.CLOSE_BROWSER);

                return;
            } catch(err) {
                this.emitMessageEvent('Failed to terminate browser properly.');
            }
        }

        await extractor.getBookmarksPage()
            .mapAsync(async (bookmarksPage) => await bookmarksPage.close());
        this.emitProgressEvent(ExtractionTask.CLOSE_BROWSER);
    }

    protected async exportTweets(tweets: Tweet[]) {
        try {
            const fileName = this.taskOptions.fileName;
            if(!isEmpty(fileName)) {
                const exporter: Exporter = new JSONExporter(fileName!);
                await exporter.export(tweets);
            }
        } catch(err) {
            this.emitMessageEvent('Failed to export tweets to file.');
        } finally {
            this.emitProgressEvent(ExtractionTask.EXPORT_TWEETS);
        }
    }

    protected async printTweetsToStdOut(tweets: Tweet[]) {
        const stdOutExporter = new StdOutExporter();
        await stdOutExporter.export(tweets);
    }

    protected onError(err: Error): never {
        this.emitMessageEvent(err.message);

        if(err.stack)
            this.emitMessageEvent(err.stack);

        return this.errorCallback(err);
    }
}
