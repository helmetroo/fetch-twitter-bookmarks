import type { URLSearchParams } from 'url';

import { Twitter } from '../constants/twitter';
import DataExtractor from './data-extractor';
import type { ExtractedTweet } from './data-extractor';

export default class BookmarksRequester {
    protected requestHeader?: Twitter.Api.RequestHeader
    protected requestParams?: URLSearchParams
    protected requestCursor?: string;
    protected fetchedBookmarks: ExtractedTweet[] = [];

    init(
        reqHeader: Twitter.Api.RequestHeader,
        reqSearchParams: URLSearchParams,
        response: Twitter.Api.SuccessResponse
    ) {
        this.requestHeader = reqHeader;
        this.requestParams = reqSearchParams;

        const dataExtractor = new DataExtractor(response);
        this.requestCursor = dataExtractor.cursor;
        this.fetchedBookmarks = dataExtractor.tweets;
    }

    get bookmarks() {
        return this.fetchedBookmarks;
    }
}
