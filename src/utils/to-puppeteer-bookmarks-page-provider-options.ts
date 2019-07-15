import { ValidPuppeteerArgs } from '@args/puppeteer-args';
import PuppeteerBookmarksPageProviderOptions from '@bookmarks-page-providers/puppeteer-bookmarks-page-provider-options';

const toPuppeteerBookmarksPageProviderOptions = (args: ValidPuppeteerArgs) => {
    const {
        username,
        password,
        chromePath,
        inspect,
    } = args;

    const credentials = {
        username,
        password
    };

    const pageManagerOptions: PuppeteerBookmarksPageProviderOptions = {
        credentials,
        chromePath,
        inspect,
    };

    return pageManagerOptions;
}

export default toPuppeteerBookmarksPageProviderOptions;
