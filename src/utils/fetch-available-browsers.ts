import { chromium, webkit, firefox, BrowserType } from 'playwright';

export type BrowserName = 'chromium' | 'firefox' | 'webkit';

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
            name: <BrowserName> browser.name()
        }
    });
}

export interface AvailableBrowser {
    browser: BrowserType,
    name: BrowserName
};
