import { Page, Browser } from 'puppeteer';
import { injectable as Injectable } from 'inversify';

import PageProviderOptions from './bookmarks-page-provider-options';
import ProgressEventEmitter from './progress-event-emitter';
import Maybe from './maybe';

@Injectable()
export default abstract class BookmarksPageProvider extends ProgressEventEmitter {
    public static readonly CREATE_BROWSER: string = 'extractor:browser:create';
    public static readonly BOOKMARKED_TWEETS_PAGE: string = 'extractor:page:load-bookmarks';
    public static readonly CLOSE_BROWSER: string = 'extractor:browser:close';

    public static readonly PROGRESS_EVENTS: string[] = [
        BookmarksPageProvider.CREATE_BROWSER,
        BookmarksPageProvider.BOOKMARKED_TWEETS_PAGE,
        BookmarksPageProvider.CLOSE_BROWSER
    ];

    protected launched: boolean = false;

    protected options: Maybe<PageProviderOptions> =
        Maybe.none<PageProviderOptions>();

    protected browser: Maybe<Browser> = Maybe.none<Browser>();
    protected bookmarksPage: Maybe<Page> = Maybe.none<Page>();

    public async open() {
        this.browser = await this.createBrowser();
        this.emitProgressEvent(BookmarksPageProvider.CREATE_BROWSER);
        this.launched = true;

        const bookmarksPage = await this.resolveBookmarksPage();
        this.bookmarksPage = Maybe.fromValue(bookmarksPage);
        this.emitProgressEvent(BookmarksPageProvider.BOOKMARKED_TWEETS_PAGE);

        return bookmarksPage;
    }

    public async close() {
        try {
            if(!this.launched)
                return;

            await this.terminateBrowser();
        } catch(err) {
            this.emitMessageEvent('Failed to terminate browser properly.');
        } finally {
            this.emitProgressEvent(BookmarksPageProvider.CLOSE_BROWSER);
        }
    }

    public setOptions(options: PageProviderOptions) {
        this.options = Maybe.fromValue(options);
    }

    protected async terminateBrowser() {
        return this.options.mapAsync(async (options) => {
            const hasChromePath =
                !!options.chromePath;

            await (hasChromePath)
                ? BookmarksPageProvider.closeBookmarksPage(this.bookmarksPage)
                : BookmarksPageProvider.closeBrowser(this.browser);
        });
    }

    protected static async closeBrowser(browser: Maybe<Browser>) {
        await browser
            .mapAsync(async (browser) => await browser.close());
    }

    protected static async closeBookmarksPage(bookmarksPage: Maybe<Page>) {
        await bookmarksPage
            .mapAsync(async (page) => await page.close());
    }

    protected abstract async createBrowser(): Promise<Maybe<Browser>>;
    protected abstract async resolveBookmarksPage(): Promise<Page>;
}
