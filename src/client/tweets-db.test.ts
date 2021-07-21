import {
    constants
} from 'fs';
import faker from 'faker';

import rootPathTo from '../utils/root-path-to';
import { PromisifiedFS } from '../utils/promisified-fs';
import { Application } from '../constants/application';
import { TweetsDB } from './tweets-db';

function createFakeId() {
    return faker.datatype.number({
        min: 1e16,
        max: 1e16
    }).toString();
}

function createFakeTweet() {
    const tweetId = createFakeId();
    const userId = createFakeId();

    const author: Application.User = {
        id_str: userId,
        created_date: faker.datatype.datetime(Date.now()),
        blocked_by: faker.datatype.boolean(),
        blocking: faker.datatype.boolean(),
        can_dm: faker.datatype.boolean(),
        can_media_tag: faker.datatype.boolean(),
        default_profile: faker.datatype.boolean(),
        default_profile_image: faker.datatype.boolean(),
        description: faker.lorem.paragraph(1).substring(0, 160),
        entities: {
            description: {
                urls: []
            },

            url: {
                urls: []
            }
        },
        fast_followers_count: faker.datatype.number(10),
        favourites_count: faker.datatype.number(1e6),
        follow_request_sent: faker.datatype.boolean(),
        followed_by: faker.datatype.boolean(),
        followers_count: faker.datatype.number(1e7),
        following: faker.datatype.boolean(),
        friends_count: faker.datatype.number(1e6),
        has_custom_timelines: faker.datatype.boolean(),
        is_translator: faker.datatype.boolean(),
        listed_count: faker.datatype.number(1e2),
        location: `${faker.address.city()}, ${faker.address.stateAbbr()}`,
        media_count: faker.datatype.number(1e3),
        muting: faker.datatype.boolean(),
        name: faker.name.findName(),
        normal_followers_count: faker.datatype.number(1e8),
        notifications: faker.datatype.boolean(),
        pinned_tweet_ids_str: [],
        profile_banner_extensions: {
            mediaColor: {
                r: {
                    ok: {
                        palette: [{
                            percentage: faker.datatype.float({
                                min: 0,
                                max: 100
                            }),
                            rgb: {
                                red: faker.datatype.number(255),
                                green: faker.datatype.number(255),
                                blue: faker.datatype.number(255)
                            }
                        }]
                    }
                }
            }
        },
        profile_image_url_https: faker.internet.avatar(),
        profile_interstitial_type: '',
        protected: faker.datatype.boolean(),
        screen_name: faker.internet.userName(),
        statuses_count: faker.datatype.number(1e6),
        translator_type: 'none',
        url: faker.internet.url(),
        verified: faker.datatype.boolean(),
        want_retweets: faker.datatype.boolean(),
        withheld_in_countries: []
    };

    const tweet: Application.Tweet = {
        author,

        id_str: tweetId,
        conversation_id_str: tweetId,
        author_id_str: userId,
        created_date: faker.datatype.datetime(Date.now()),
        display_text_range: [],
        entities: {
            media: [],
            user_mentions: [],
            urls: [],
            hashtags: [],
            symbols: []
        },
        extended_entities: {
            media: []
        },
        favorite_count: faker.datatype.number(1e6),
        favorited: faker.datatype.boolean(),
        full_text: faker.lorem.paragraph(1).substring(0, 160),
        is_quote_status: faker.datatype.boolean(),
        lang: faker.random.locale().substring(0, 2),
        possibly_sensitive: faker.datatype.boolean(),
        possibly_sensitive_editable: faker.datatype.boolean(),
        reply_count: faker.datatype.number(1e6),
        retweet_count: faker.datatype.number(1e6),
        retweeted: faker.datatype.boolean(),
        source: '<a href=\"https://github.com/helmetroo/fetch-twitter-bookmarks.git" rel=\"nofollow\">fetch-twitter-bookmarks</a>',
        self_thread_id_str: tweetId
    };

    return tweet;
}

function createFakeCursor() {
    const cursor: Application.Cursor = {
        top: faker.datatype.number(1e17).toString(),
        bottom: faker.datatype.number(1e17).toString()
    };

    return cursor;
}

const TEST_DB_PATH = rootPathTo('test-twitter-bookmarks.db');

describe('TweetsDB', () => {
    it('Should setup the database to be in memory if requested, then shut down', () => {
        const db = new TweetsDB.Database({
            inMemory: true,
            logging: false
        });

        expect(async () => {
            await db.init();
            await db.close();
        }).not.toThrow();
    });

    it('Should setup a database at a given path', async () => {
        const db = new TweetsDB.Database({
            inMemory: false,
            storagePath: TEST_DB_PATH,
            logging: false
        });
        await db.init();
        await db.close();

        expect(async () => {
            await PromisifiedFS.access(TEST_DB_PATH, constants.F_OK);
            await PromisifiedFS.rm(TEST_DB_PATH);
        }).not.toThrow();
    });

    it('Should allow for logging if set', async () => {
        const logFn = jest.fn();
        const db = new TweetsDB.Database({
            inMemory: false,
            storagePath: TEST_DB_PATH,
            logging: logFn
        });

        await db.init();
        expect(logFn).toBeCalled();

        await db.close();
    });

    it('Should allow tweets and their authors to be saved and later retrieved', async () => {
        const db = new TweetsDB.Database({
            inMemory: true,
            logging: false
        });
        await db.init();

        const newTweet = createFakeTweet();
        await db.insertTweets([newTweet]);

        const savedTweet = await db.getTweetById(newTweet.id_str);
        expect(newTweet).not.toBeNull();

        const savedTweetJson = savedTweet!.toJSON();
        const { author, ...newTweetSansAuthor } = newTweet;
        expect(savedTweetJson).toMatchObject(newTweetSansAuthor);

        const savedAuthor = await db.getTweetAuthor(savedTweet!);
        expect(savedAuthor).not.toBeNull();

        const savedAuthorJson = savedAuthor!.toJSON();
        expect(savedAuthorJson).toMatchObject(newTweet.author);

        await db.close();
    });

    it('Should allow cursor state to be persisted and later retrieved', async () => {
        const db = new TweetsDB.Database({
            inMemory: true,
            logging: false
        });
        await db.init();

        const cursor = createFakeCursor();
        await db.persistCursorState(cursor);

        const persistedCursor = await db.getCursorState();
        expect(persistedCursor).not.toBeNull();

        const persistedCursorJson = persistedCursor!.toJSON();
        expect(persistedCursorJson).toMatchObject(cursor);
    });
});
