import { ValidAppInterfaceArgs } from '@args/valid-app-interface-args';

import BookmarksPageProvider from './bookmarks-page-provider';

type TestableBookmarksPageProviderCreator =
    (args: ValidAppInterfaceArgs) => BookmarksPageProvider;
export default TestableBookmarksPageProviderCreator;
