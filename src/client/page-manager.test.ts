import PageManager, { PATHNAMES } from './page-manager';
import { INVALID_CREDENTIALS } from './credentials';

const testSuiteFor = describe.each(global.availableBrowsers);
testSuiteFor('PageManager', ({ browser }) => {
    it('Should successfully initialize and close chromium', () => {
        const pageManager = new PageManager();
        pageManager.setBrowserType(browser);

        expect(async () => await pageManager.init()).not.toThrow();
        expect(async () => await pageManager.tearDown()).not.toThrow();
    });

    it('Should not be logged in after providing incorrect credentials', async () => {
        const pageManager = new PageManager();
        pageManager.setBrowserType(browser);

        await pageManager.init();
        await pageManager.logIn(INVALID_CREDENTIALS);
        const atLogInError = pageManager.currentUrlHasPath(PATHNAMES.logInError);
        await pageManager.tearDown();

        expect(atLogInError).toBeTruthy();
    });
});
