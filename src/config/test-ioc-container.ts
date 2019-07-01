import { Container } from 'inversify';

import AppInterface from '../interfaces/app-interface';
import BookmarksPageProvider from '../interfaces/bookmarks-page-provider';

import MockAppInterface from '../mock-app-interface';
import MockBookmarksPageProvider from '../mock-bookmarks-page-provider';

import TYPE_TOKENS from '../tokens/all';
const {
    BookmarksPageProvider: BookmarksPageProviderToken,
    AppInterface: AppInterfaceToken
} = TYPE_TOKENS;

const testContainer = new Container();
testContainer.bind<BookmarksPageProvider>(BookmarksPageProviderToken)
    .to(MockBookmarksPageProvider);
testContainer.bind<AppInterface>(AppInterfaceToken)
    .to(MockAppInterface);

export default testContainer;
