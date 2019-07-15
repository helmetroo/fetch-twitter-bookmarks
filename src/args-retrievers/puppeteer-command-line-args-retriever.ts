import ExtractionTaskArgs from '@args/extraction-task-args';
import PuppeteerArgs from '@args/puppeteer-args';

import PuppeteerArgsValidator from '@args-validators/puppeteer-args-validator';

import CommandLineExtractionTaskArgsParser from '@args-parsers/command-line-extraction-task-args-parser';
import CommandLinePuppeteerArgsParser from '@args-parsers/command-line-puppeteer-args-parser';

import PuppeteerArgsRetriever from './puppeteer-args-retriever';

export default class PuppeteerCommandLineArgsRetriever extends PuppeteerArgsRetriever {
    constructor(
        private readonly args: string[],
        protected readonly puppeteerArgsValidator: PuppeteerArgsValidator
    ) {
        super(puppeteerArgsValidator);
    }

    protected getExtractionTaskArgsParser() {
        return new CommandLineExtractionTaskArgsParser(this.args);
    }

    protected getPuppeteerArgsParser() {
        return new CommandLinePuppeteerArgsParser(this.args);
    }
}
