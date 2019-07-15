import BookmarksPageProvider from '@interfaces/bookmarks-page-provider';

import TestableBookmarksPage from './testable-bookmarks-page';

export default class TestableBookmarksPageProvider extends BookmarksPageProvider {
    protected async open() {
        return TestableBookmarksPage;
    }

    protected async close() {}
}
