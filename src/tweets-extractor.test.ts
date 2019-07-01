import { from, Subscription, Observer, Observable } from 'rxjs';
import { scan, switchMap } from 'rxjs/operators';
import { Arg } from '@fluffy-spoon/substitute';

import TweetSet from './interfaces/tweet-set';

import TweetsExtractor from './tweets-extractor';
import TweetContainer from './tweet-container';
import TweetContainerList from './tweet-container-list';
import MockBookmarksPage from './mock-bookmarks-page';

const fakeTweetContainers = new TweetContainerList(
    new TweetContainer()
        .withTweetProfile('helmetroo')
        .withTweetText('This tweet has text!'),

    new TweetContainer()
        .withTweetProfile('helmetroo')
        .withEmptyTweetText(),

    new TweetContainer()
        .withEmptyTweetText()
        .withTweetProfile('helmetroo')
        .withTweetImages(['https://pbs.twimg.com/media/D9_AGCtWsAEdWYl?format=jpg&name=medium']),

    new TweetContainer()
        .withTweetText('This tweet has an image!')
        .withTweetProfile('helmetroo')
        .withTweetImages(['https://pbs.twimg.com/media/D9_AGCtWsAEdWYl?format=jpg&name=medium']),

    new TweetContainer()
        .withTweetText('This tweet has two images!')
        .withTweetProfile('helmetroo')
        .withTweetImages(['https://pbs.twimg.com/media/D9_AGCtWsAEdWYl?format=jpg&name=medium',
                          'https://pbs.twimg.com/media/D9_AGCtWsAEdWYl?format=jpg&name=medium']),

    new TweetContainer()
        .withTweetText('This tweet has a video!')
        .withTweetProfile('helmetroo')
        .withTweetVideo('https://video.twimg.com/tweet_video/D98d35_VAAE9nG8.mp4'),
);

const tweetContainerElements =
    fakeTweetContainers.elements;

MockBookmarksPage.waitForSelector('article')
    .returns(Promise.resolve(null));

// One-time scrolling
MockBookmarksPage.evaluate(Arg.all())
    .returns(Promise.resolve(false));

MockBookmarksPage.$$('article')
    .returns(Promise.resolve(tweetContainerElements));

test('all tweets should be extracted', async () => {
    const extractor = new TweetsExtractor();
    const extraction$ =
        extractor.extract(MockBookmarksPage).pipe(
            scan((currentTweets: TweetSet, newTweets: TweetSet) => currentTweets.union(newTweets)),
        );

    const tweets = await extraction$.toPromise();
    expect(tweets.size).toEqual(tweetContainerElements.length);
});
