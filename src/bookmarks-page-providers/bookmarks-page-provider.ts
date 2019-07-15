import { Page } from 'puppeteer';

import ProgressEventEmitter from '@interfaces/progress-event-emitter';
import Maybe from '@interfaces/maybe';

export default abstract class BookmarksPageProvider extends ProgressEventEmitter {
    public readonly PROGRESS_EVENTS: string[] = [];

    protected bookmarksPage: Maybe<Page> = Maybe.none<Page>();

    public abstract async open(): Promise<Page>;
    public abstract async close(): Promise<void>;
}
