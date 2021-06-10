import { chromium, webkit, firefox, BrowserType } from 'playwright';

export default async function fetchAvailableBrowsers() {
    let availableBrowsers: BrowserType[] = [];
    const allBrowsers = [chromium, webkit, firefox];
    for(const browser of allBrowsers) {
        try {
            await browser.launch();
            availableBrowsers.push(browser);
        } catch(err) { continue; }
    }

    return availableBrowsers.map(browser => {
        return {
            browser,
            name: browser.name()
        }
    });
}

export interface AvailableBrowser {
    browser: BrowserType,
    name: string
};
