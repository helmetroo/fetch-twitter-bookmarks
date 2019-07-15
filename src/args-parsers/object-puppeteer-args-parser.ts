import defaults from 'lodash.defaults';

import PuppeteerArgsParser from './puppeteer-args-parser';
import PuppeteerArgs, { PUPPETEER_ARGS_DEFAULTS } from '@args/puppeteer-args';

export default class ObjectPuppeteerArgsParser implements PuppeteerArgsParser {
    constructor(
        private readonly args: Partial<PuppeteerArgs>
    ) {}

    public getPuppeteerArgs() {
        return defaults(this.args, PUPPETEER_ARGS_DEFAULTS);
    }
}
