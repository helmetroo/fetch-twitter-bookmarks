import { ValidPuppeteerArgs } from '@args/puppeteer-args';
import PuppeteerArgsParser from '@args-parsers/puppeteer-args-parser';
import PuppeteerArgsValidator from '@args-validators/puppeteer-args-validator';

import ArgsRetriever from './args-retriever';

export default abstract class PuppeteerArgsRetriever extends ArgsRetriever {
    constructor(
        protected readonly puppeteerArgsValidator: PuppeteerArgsValidator
    ) {
        super();
    }

    public async getPuppeteerArgs() {
        const argsParser = this.getPuppeteerArgsParser();
        const puppeteerArgs = argsParser.getPuppeteerArgs();

        return this.puppeteerArgsValidator.validate(puppeteerArgs);
    };

    protected abstract getPuppeteerArgsParser(): PuppeteerArgsParser;
}
