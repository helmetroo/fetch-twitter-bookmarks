import puppeteer from 'puppeteer';
import minimist from 'minimist';

import TwitterExtractor from './extractors/twitter';
import UsernamePasswordCredentials from './interfaces/username-password-credentials';

import ProgressBar from './progress-bar';

(async () => {
    try {
        const browser = await puppeteer.launch({
            headless: false,
            defaultViewport: null
        });
        const credentials = <UsernamePasswordCredentials> minimist(process.argv.slice(2), {
            string: [
                'username',
                'password'
            ],

            default: {
                username: '',
                password: ''
            }
        });
        const te = new TwitterExtractor(browser, credentials);
        const pb = new ProgressBar(te);
        pb.startWatching();
        await te.extract();
        process.exit(0);
    } catch(err) {
        console.error(err.message);
        console.error(err.stack);
        process.exit(1);
    }
})()
