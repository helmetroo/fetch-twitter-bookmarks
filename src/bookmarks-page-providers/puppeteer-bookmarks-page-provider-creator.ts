import { ValidPuppeteerArgs } from '@args/valid-puppeteer-args';

import PuppeteerBookmarksPageProvider from './bookmarks-page-provider';

type PuppeteerBookmarksPageProviderCreator = (args: ValidPuppeteerArgs) => PuppeteerBookmarksPageProvider;
export default PuppeteerBookmarksPageProviderCreator;
