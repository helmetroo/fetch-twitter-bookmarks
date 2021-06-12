import { Twitter } from '../constants/twitter';

export interface ExtractedTweet extends Twitter.Api.Tweet {
    user: Twitter.Api.UserSchema;
}

export default class DataExtractor {
    protected entries: Twitter.Api.TimelineEntries;

    constructor(
        protected response: Twitter.Api.SuccessResponse
    ) {
        // TODO may not be a bad idea to verify that type is AddEntries?
        this.entries = response.data.bookmark_timeline.timeline.instructions[0]!.entries;
    }

    get tweets() {
        const tweetEntries = <Twitter.Api.TweetEntry[]> this.entries.slice(0, -2);
        return tweetEntries.map(entry => {
            const {
                core: {
                    user: user
                },
                legacy: tweet
            } = entry.content.itemContent.tweet_results.result;

            return {
                ...tweet,
                user
            };
        });
    }

    get cursor() {
        const bottomCursor =
            <Twitter.Api.CursorBottomEntry> this.entries[this.entries.length - 1];
        return bottomCursor.content.value;
    }
}
