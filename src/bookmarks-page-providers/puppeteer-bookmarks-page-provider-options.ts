import BookmarksPageProviderOptions from './bookmarks-page-provider-options'
import ValidUsernamePasswordCredentials from './valid-username-password-credentials';

export default interface PuppeteerBookmarksPageProviderOptions extends BookmarksPageProviderOptions {
    credentials: ValidUsernamePasswordCredentials;
    chromePath: string | null;
    inspect: boolean:
}
