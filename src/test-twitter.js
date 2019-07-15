'use strict';

const puppeteer = require('puppeteer');

(async function main() {
    try {
        const browser = await puppeteer.launch({
            headless: false,
            userDataDir: 'test-profile-dir',
            defaultViewport: null
        });
        const [page] = await browser.pages();
        await page.goto('https://twitter.com');
        await page.waitForNavigation();
        console.log(await page.evaluate(() => document.title));
    } catch (err) {
        console.error(err);
    }
})();
