import { Page } from 'puppeteer';

export default interface BookmarksPage {
    waitForSelector: Page['waitForSelector'];
    $: Page['$'];
    $$: Page['$$'];
    evaluate: Page['evaluate'];
}
