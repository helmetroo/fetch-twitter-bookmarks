import { Browser } from 'puppeteer';
import Substitute from '@fluffy-spoon/substitute';

import BookmarksPageProvider from './interfaces/bookmarks-page-provider';
import Maybe from './interfaces/maybe';

import MockBookmarksPage from './mock-bookmarks-page';

export default class MockBookmarksPageProvider extends BookmarksPageProvider {
    protected async createBrowser() {
        return Maybe.fromValue(Substitute.for<Browser>());
    }

    protected async resolveBookmarksPage() {
        return MockBookmarksPage;
    }
}
