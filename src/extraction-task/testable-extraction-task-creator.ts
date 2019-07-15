import { injectable as Injectable, inject as Inject } from 'inversify';

import BookmarksPageProvider from '@bookmarks-page-providers/bookmarks-page-provider';

import createExtractionTask from './create-extraction-task';
import ExtractionTaskCreator from './extraction-task-creator';

import IOC_TOKENS from '@ioc-tokens';
const {
    ArgsRetriever: ArgsRetrieverType
} = IOC_TOKENS;

@Injectable()
export default class TestableExtractionTaskCreator extends ExtractionTaskCreator {
    constructor(
        @Inject(ArgsRetrieverType)
        private readonly argsRetriever: ArgsRetriever;
    ) {
        super();
    }

    public create() {
        const extractionTaskArgs = this.argsRetriever.getExtractionTaskArgs();
        const bookmarksPageProvider = new BookmarksPageProvider(bookmarksPageProviderOptions);

        return createExtractionTask(bookmarksPageProvider, extractionTaskArgs);
    }
}
