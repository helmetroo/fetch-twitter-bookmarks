import { Container } from 'inversify';

import AppInterface from '@interfaces/app-interface';
import BookmarksPageProvider from '@interfaces/bookmarks-page-provider';

import TestableAppInterface from '../testable-app-interface';
import TestableBookmarksPageProvider from '../testable-bookmarks-page-provider';

import TYPE_TOKENS from '@ioc-tokens/index';
const {
    BookmarksPageProvider: BookmarksPageProviderToken,
    AppInterface: AppInterfaceToken
} = TYPE_TOKENS;

const testContainer = new Container();
testContainer.bind<BookmarksPageProvider>(BookmarksPageProviderToken)
    .to(TestableBookmarksPageProvider);
testContainer.bind<AppInterface>(AppInterfaceToken)
    .to(TestableAppInterface);

export default testContainer;
