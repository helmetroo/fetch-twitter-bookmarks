import { Opts } from 'minimist';

import PuppeteerArgs, { PUPPETEER_ARGS_DEFAULTS } from '@args/puppeteer-args';

import CommandLineArgsParser from './command-line-args-parser';
import PuppeteerArgsParser from './puppeteer-args-parser';

export default class CommandLinePuppeteerArgsParser
extends CommandLineArgsParser
implements PuppeteerArgsParser {
    private static readonly MINIMIST_OPTS: Opts = {
        string: [
            'username',
            'password',
            'chromePath',
        ],

        boolean: [
            'inspect',
        ],

        default: PUPPETEER_ARGS_DEFAULTS
    };

    constructor(
        private readonly args: string[]
    ) {
        super();
    }

    public getPuppeteerArgs() {
        return this.parse(
            this.args, CommandLinePuppeteerArgsParser.MINIMIST_OPTS
        ) as unknown as PuppeteerArgs;
    }
}
