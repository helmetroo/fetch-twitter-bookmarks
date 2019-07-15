import { ValidExtractionTaskArgs } from '@args/extraction-task-args';

import BookmarksPageProvider from '@bookmarks-page-providers/bookmarks-page-provider';

import ExtractionTask from './extraction-task';
import TweetsExtractor from '../tweets-extractor';

const createExtractionTask = (
    bookmarksPageProvider: BookmarksPageProvider,
    extractionTaskArgs: ValidExtractionTaskArgs
) => {
    const tweetsExtractor = new TweetsExtractor();

    const extractionTask = new ExtractionTask(
        bookmarksPageProvider,
        tweetsExtractor,
        extractionTaskArgs
    );

    return extractionTask;
}

export default createExtractionTask;
