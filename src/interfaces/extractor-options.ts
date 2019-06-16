import { Browser } from 'puppeteer';

import UsernamePasswordCredentials from './username-password-credentials';

export default interface TwitterBookmarksExtractorOptions {
    credentials: UsernamePasswordCredentials;
    browser: Browser;
    maxLimit: number;
    newTab: boolean;
}
