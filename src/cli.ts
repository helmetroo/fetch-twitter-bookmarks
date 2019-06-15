import puppeteer, { Browser, LaunchOptions as PuppeteerLaunchOptions } from 'puppeteer';
import minimist from 'minimist';
import { isEmpty } from 'lodash';

import CommandLineArgs from './interfaces/command-line-args';
import ValidCommandLineArgs from './interfaces/valid-command-line-args';
import UsernamePasswordCredentials from './interfaces/username-password-credentials';
import Tweet from './interfaces/tweet';
import Maybe, { isNil } from './interfaces/maybe';

import TwitterBookmarksExtractor from './extractor';
import TwitterBookmarksExtractorOptions from './interfaces/extractor-options';

import Exporter from './exporters/exporter';
import JSONExporter from './exporters/json';
import StdOutExporter from './exporters/std-out';

import ProgressBar from './progress-bar';

export default class CommandLineInterface {
    protected static getCommandLineArgs() {
        const cmdLineArgs = <CommandLineArgs> minimist(process.argv.slice(2), {
            string: [
                'username',
                'password',
                'fileName',
                'useChromeExecutable',
            ],

            default: {
                username: null,
                password: null,
                fileName: null,
                maxLimit: Number.POSITIVE_INFINITY,
                useChromeExecutable: null
            }
        });

        return CommandLineInterface.validateCmdLineArgs(cmdLineArgs);
    }

    protected static validateCmdLineArgs(cmdLineArgs: CommandLineArgs) {
        const {
            username,
            password,
            maxLimit,
        } = cmdLineArgs;

        if(isEmpty(username) || isEmpty(password)) {
            const noCredentialsErr = new Error('No credentials provided.');
            throw noCredentialsErr;
        }

        if(!Number.isInteger(maxLimit) && maxLimit !== Number.POSITIVE_INFINITY) {
            const notValidLimitErr = new Error('Invalid max limit. Must be an integer.');
            throw notValidLimitErr;
        }

        // TODO verify if chromeExecutable was provided, check if it exists at provided path
        return <ValidCommandLineArgs> cmdLineArgs;
    }

    protected static toExtractorConfig(cmdLineArgs: ValidCommandLineArgs) {
        const {
            username,
            password,
            maxLimit,
            useChromeExecutable
        } = cmdLineArgs; 

        const credentials: UsernamePasswordCredentials = {
            username,
            password
        };

        const options: TwitterBookmarksExtractorOptions = {
            maxLimit,
            newTab: !isEmpty(useChromeExecutable)
        };

        return {
            credentials,
            options
        };
    }

    protected static getPuppeteerLaunchOptions(cmdLineArgs: CommandLineArgs) {
        const {
            useChromeExecutable
        } = cmdLineArgs;

        const puppeteerOptions: PuppeteerLaunchOptions = {
            defaultViewport: null
        };

        if(useChromeExecutable)
            puppeteerOptions.executablePath = useChromeExecutable;

        return puppeteerOptions;
    }

    protected static async extractTweets(extractor: TwitterBookmarksExtractor) {
        const progressBar = new ProgressBar(extractor);

        progressBar.startWatching();
        const tweets = await extractor.extract();
        progressBar.stopWatching();

        return tweets;
    }

    public async run() {
        const cmdLineArgs =
            CommandLineInterface.tryGetCommandLineArgs();

        const browser =
            await CommandLineInterface.tryCreateBrowser(cmdLineArgs);

        const extractor =
            CommandLineInterface.createBookmarksExtractor(cmdLineArgs, browser);

        const tweets =
            await CommandLineInterface.tryExtractTweets(extractor);

        await CommandLineInterface
            .tryEndBrowserSession(cmdLineArgs, browser, extractor);

        await CommandLineInterface.exportTweets(tweets, cmdLineArgs);

        CommandLineInterface.exitWithSuccess();
    }

    protected static tryGetCommandLineArgs() {
        let cmdLineArgs: ValidCommandLineArgs;
        try {
            cmdLineArgs =
                CommandLineInterface.getCommandLineArgs();
        } catch(err) {
            return CommandLineInterface.exitWithError(err);
        }

        return cmdLineArgs;
    }

    protected static async tryCreateBrowser(cmdLineArgs: ValidCommandLineArgs) {
        const puppeteerLaunchOpts =
            CommandLineInterface.getPuppeteerLaunchOptions(cmdLineArgs);

        let browser: Browser;
        try {
            browser = await puppeteer.launch(puppeteerLaunchOpts);
        } catch(err) {
            const noBrowserErr = new Error(`Couldn't start browser.`);
            return CommandLineInterface.exitWithError(noBrowserErr);
        }

        return browser;
    }

    protected static createBookmarksExtractor(
        cmdLineArgs: ValidCommandLineArgs,
        browser: Browser
    ) {
        const extractorConfig =
            CommandLineInterface.toExtractorConfig(cmdLineArgs);
        const {
            credentials,
            options
        } = extractorConfig;
        const extractor = new TwitterBookmarksExtractor(browser, credentials, options);

        return extractor;
    }

    protected static async tryExtractTweets(
        extractor: TwitterBookmarksExtractor
    ) {
        try {
            const tweets = await CommandLineInterface.extractTweets(extractor);
            return tweets;
        } catch(err) {
            const cantGetTweetsErr = new Error('Failed to extract tweets.');
            return CommandLineInterface.exitWithError(cantGetTweetsErr);
        }

        return <Tweet[]> [];
    }

    protected static async tryEndBrowserSession(
        cmdLineArgs: ValidCommandLineArgs,
        browser: Browser,
        extractor: TwitterBookmarksExtractor
    ) {
        const useChromeExecutable =
            cmdLineArgs.useChromeExecutable;
        if(!useChromeExecutable) {
            try {
                await browser.close();
                return;
            } catch(err) {
                console.error('Failed to terminate browser properly.');
            }
        }

        extractor.getBookmarksPage()
            .mapAsync(async (bookmarksPage) => await bookmarksPage.close());
    }

    protected static async exportTweets(
        tweets: Tweet[],
        cmdLineArgs: ValidCommandLineArgs
    ) {
        try {
            const fileName = cmdLineArgs.fileName;
            if(!isEmpty(fileName)) {
                const exporter: Exporter = new JSONExporter(fileName!);
                await exporter.export(tweets);
            }
        } catch(err) {
            console.error('Failed to export tweets to file.');
        }

        const stdOutExporter = new StdOutExporter();
        await stdOutExporter.export(tweets);
    }

    protected static exitWithSuccess() {
        return process.exit(0);
    }

    protected static exitWithError(err: Error) {
        console.error(err.message);
        return process.exit(1);
    }
}
