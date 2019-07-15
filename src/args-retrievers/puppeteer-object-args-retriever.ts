import ExtractionTaskArgs from '@args/extraction-task-args';
import PuppeteerArgs from '@args/puppeteer-args';

import PuppeteerArgsValidator from '@args-validators/puppeteer-args-validator';
;
import ObjectExtractionTaskArgsParser from '@args-parsers/object-extraction-task-args-parser';
import ObjectPuppeteerArgsParser from '@args-parsers/object-puppeteer-args-parser';

import PuppeteerArgsRetriever from './puppeteer-args-retriever';

export default class PuppeteerObjectArgsRetriever extends PuppeteerArgsRetriever {
    constructor(
        private readonly args: Partial<ExtractionTaskArgs & PuppeteerArgs>,
        protected readonly puppeteerArgsValidator: PuppeteerArgsValidator
    ) {
        super(puppeteerArgsValidator);
    }

    protected getExtractionTaskArgsParser() {
        return new ObjectExtractionTaskArgsParser(this.args);
    }

    protected getPuppeteerArgsParser() {
        return new ObjectPuppeteerArgsParser(this.args);
    }
}
