import { Twitter } from '../constants/twitter';
import { Application } from '../constants/application';

export default class DataExtractor {
    protected readonly entries: Twitter.Api.TimelineEntries;

    // Cache
    protected foundTweets?: Application.Tweet[];
    protected foundCursor?: Application.Cursor;

    constructor(
        protected readonly response: Twitter.Api.SuccessResponse
    ) {
        // TODO may not be a bad idea to verify that type is AddEntries?
        this.entries =
            response.data.bookmark_timeline.timeline.instructions[0]!.entries;
    }

    get tweets(): Application.Tweet[] {
        if(this.foundTweets)
            return this.foundTweets;

        const tweetEntries = <Twitter.Api.TweetEntry[]> this.entries.slice(0, -2);
        this.foundTweets =
            tweetEntries.map(entry => {
                const tweetResult =
                    entry.content.itemContent.tweet_results.result;

                const tweetData = tweetResult.legacy;
                const authorData = tweetResult.core.user.legacy;
                const authorCreationDate = new Date(authorData.created_at);
                const author: Application.User = {
                    ...authorData,
                    id_str: tweetData.user_id_str,
                    created_date: authorCreationDate
                }

                const tweetCreationDate = new Date(tweetData.created_at);
                const tweet: Application.Tweet = {
                    ...tweetData,
                    author,
                    author_id_str: author.id_str,
                    created_date: tweetCreationDate
                };
                if(tweetData.self_thread) {
                    tweet.self_thread_id_str =
                        tweetData.self_thread.id_str;
                }

                return tweet;
            });

        return this.foundTweets;
    }

    get cursor(): Application.Cursor {
        if(this.foundCursor)
            return this.foundCursor;

        const topCursor =
            <Twitter.Api.CursorTopEntry> this.entries[this.entries.length - 2];

        const bottomCursor =
            <Twitter.Api.CursorBottomEntry> this.entries[this.entries.length - 1];

        this.foundCursor = {
            top: topCursor.content.value,
            bottom: bottomCursor.content.value
        };

        return this.foundCursor;
    }

    get data() {
        return {
            tweets: this.tweets,
            cursor: this.cursor
        };
    }
}
