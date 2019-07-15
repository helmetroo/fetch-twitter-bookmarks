import { EventEmitter } from 'events';

import testContainer from '@config/test-ioc-container';

import BookmarksPageProvider from './bookmarks-page-provider';
import { ProgressEvent } from './progress-event-emitter';

import TYPE_TOKENS from '@ioc-tokens/index';
const {
    BookmarksPageProvider: BookmarksPageProviderToken
} = TYPE_TOKENS;

const bookmarksPageProvider =
    testContainer.get<BookmarksPageProvider>(BookmarksPageProviderToken);

const {
    CREATE_BROWSER,
    BOOKMARKED_TWEETS_PAGE,
    CLOSE_BROWSER
} = BookmarksPageProvider;

const eventsCalled = {
    [CREATE_BROWSER]: false,
    [BOOKMARKED_TWEETS_PAGE]: false,
    [CLOSE_BROWSER]: false
};

const markEventCalled = (event: ProgressEvent) => {
    eventsCalled[event.name] = true;
};

beforeAll(() => {
    bookmarksPageProvider.on('progress', markEventCalled);
});

afterAll(() => {
    bookmarksPageProvider.off('progress', markEventCalled);
});

test('should only emit browser create and bookmarked tweets page open events after opening', async () => {
    await bookmarksPageProvider.open();
    expect(eventsCalled).toEqual({
        [CREATE_BROWSER]: true,
        [BOOKMARKED_TWEETS_PAGE]: true,
        [CLOSE_BROWSER]: false
    });
});

test('should emit close event when closing', async () => {
    await bookmarksPageProvider.close();
    expect(eventsCalled).toEqual({
        [CREATE_BROWSER]: true,
        [BOOKMARKED_TWEETS_PAGE]: true,
        [CLOSE_BROWSER]: true
    });
});
