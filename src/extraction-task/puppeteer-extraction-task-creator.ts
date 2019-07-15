import { injectable as Injectable, inject as Inject } from 'inversify';

import AppInterface from '@app-interfaces/app-interface';

import PuppeteerArgsRetriever from '@args-retrievers/puppeteer-args-retriever';

import PuppeteerBookmarksPageProvider from '@bookmarks-page-providers/puppeteer-bookmarks-page-provider';

import toPuppeteerBookmarksPageProviderOptions from '@utils/to-puppeteer-bookmarks-page-provider-options';

import ExtractionTaskCreator from './extraction-task-creator';
import createExtractionTask from './create-extraction-task';

import IOC_TOKENS from '@ioc-tokens';
const {
    PuppeteerArgsRetriever: PuppeteerArgsRetrieverType
} = IOC_TOKENS;

@Injectable()
export default class PuppeteerExtractionTaskCreator extends ExtractionTaskCreator {
    constructor(
        @Inject(PuppeteerArgsRetrieverType)
        private readonly argsRetriever: PuppeteerArgsRetriever
    ) {
        super();
    }

    public async create() {
        const extractionTaskArgs = this.argsRetriever.getExtractionTaskArgs();
        const puppeteerArgs = await this.argsRetriever.getPuppeteerArgs();

        const bookmarksPageProviderOptions = toPuppeteerBookmarksPageProviderOptions(puppeteerArgs);
        const bookmarksPageProvider = new PuppeteerBookmarksPageProvider(bookmarksPageProviderOptions);

        return createExtractionTask(bookmarksPageProvider, extractionTaskArgs);
    }
}
