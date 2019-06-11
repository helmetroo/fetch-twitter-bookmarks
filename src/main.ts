import { promisify } from 'util';
import {
    open as openFile,
    write as writeFile,
    close as closeFile
} from 'fs';

import puppeteer, { LaunchOptions as PuppeteerLaunchOptions } from 'puppeteer';
import minimist from 'minimist';

import TwitterExtractor, { TwitterExtractorOptions } from './extractors/twitter';
import CommandLineArgs from './interfaces/command-line-args';
import UsernamePasswordCredentials from './interfaces/username-password-credentials';

import ProgressBar from './progress-bar';

(async () => {
    try {
        const cmdLineArgs = <CommandLineArgs> minimist(process.argv.slice(2), {
            string: [
                'username',
                'password',
                'useChromeExecutable',
            ],

            default: {
                username: '',
                password: '',
                maxLimit: Number.POSITIVE_INFINITY,
                useChromeExecutable: null
            }
        });

        const credentials: UsernamePasswordCredentials = {
            username: cmdLineArgs.username,
            password: cmdLineArgs.password
        };

        const maxLimit = cmdLineArgs.maxLimit;
        if(!Number.isInteger(maxLimit)) {
            const notValidLimitErr = new Error('Invalid max limit. Must be an integer.');
            throw notValidLimitErr;
        }

        const useChromeExecutable = !!cmdLineArgs.useChromeExecutable;

        const options: TwitterExtractorOptions = {
            maxLimit: cmdLineArgs.maxLimit,
            newTab: useChromeExecutable
        };

        const puppeteerOptions: PuppeteerLaunchOptions = {
            defaultViewport: null
        };
        if(useChromeExecutable) {
            puppeteerOptions.executablePath =
                cmdLineArgs.useChromeExecutable;
        }

        const browser = await puppeteer.launch(puppeteerOptions);
        const te = new TwitterExtractor(browser, credentials, options);
        const pb = new ProgressBar(te);

        pb.startWatching();
        const tweets = await te.extract();
        if(!useChromeExecutable)
            await te.finish();
        pb.stopWatching();

        console.log('Finished. Writing tweets to tweets.json...');
        const openFileAsync = promisify(openFile);
        const tweetFileDesc = await openFileAsync('tweets.json', 'w');

        const tweetOutput = {
            tweets
        };
        const tweetOutputStr = JSON.stringify(tweetOutput);
        const writeFileAsync = promisify(writeFile);
        await writeFileAsync(tweetFileDesc, tweetOutputStr);

        const closeFileAsync = promisify(closeFile);
        await closeFileAsync(tweetFileDesc);
        console.log('Complete! Saved to tweets.json');
        process.exit(0);
    } catch(err) {
        console.error(err.message);
        console.error(err.stack);
        process.exit(1);
    }
})()
