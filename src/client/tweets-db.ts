import {
    Sequelize,
    DataTypes,
    Options,
    Model,
    Association,
    HasManyGetAssociationsMixin,
    HasManyAddAssociationMixin,
    HasManyHasAssociationMixin,
    HasManyCountAssociationsMixin,
    HasManyCreateAssociationMixin,
    Optional
} from 'sequelize';

import rootPathTo from '../utils/root-path-to';
import { Application } from '../constants/application';
import { Twitter } from '../constants/twitter';

export namespace TweetsDB {
    interface SequelizeTimestamped {
        readonly created_at: Date;
        readonly updated_at: Date;
    }

    // author in this case will refer to an instance of the Author model below.
    type OmittedTweetAttributes = 'author';
    export interface TweetSchema
    extends SequelizeTimestamped, Omit<Application.Tweet, OmittedTweetAttributes> {

    }

    interface TweetCreationSchema extends Optional<TweetSchema, 'created_at' | 'updated_at'> {}

    export interface AuthorSchema
    extends SequelizeTimestamped, Application.User {

    }

    interface AuthorCreationSchema extends Optional<AuthorSchema, 'created_at' | 'updated_at'> {}

    export interface CursorSchema
    extends SequelizeTimestamped, Application.Cursor {

    }

    interface CursorCreationSchema extends Optional<CursorSchema, 'created_at' | 'updated_at'> {}

    // Really not a fan of redeclaring attributes in these class declarations...
    // is there another way?
    class Tweet extends Model<TweetSchema, TweetCreationSchema> implements TweetSchema {
        id_str!: string;
        created_date!: Date;
        author_id_str!: string;
        conversation_id_str!: string;
        self_thread_id_str?: string;
        display_text_range!: number[];
        entities!: {
            media: Twitter.Api.Media[];
            user_mentions: Twitter.Api.Mention[];
            urls: Twitter.Api.EmbeddedURL[];
            hashtags: Twitter.Api.Tag[];
            symbols: Twitter.Api.Tag[];
        };
        extended_entities?: {
            media: Twitter.Api.Media[];
        };
        favorite_count!: number;
        favorited!: boolean;
        full_text!: string;
        is_quote_status!: boolean;
        lang!: string;
        possibly_sensitive!: boolean;
        possibly_sensitive_editable!: boolean;
        reply_count!: number;
        retweet_count!: number;
        retweeted!: boolean;
        source!: string;

        readonly created_at!: Date;
        readonly updated_at!: Date;

        readonly author?: Author;

        static associations: {
            author: Association<Tweet, Author>
        }
    }

    class Author extends Model<AuthorSchema, AuthorCreationSchema> implements AuthorSchema {
        id_str!: string;
        created_date!: Date;
        blocked_by!: boolean;
        blocking!: boolean;
        can_dm!: boolean;
        can_media_tag!: boolean;
        default_profile!: boolean;
        default_profile_image!: boolean;
        description!: string;
        entities!: {
            description: {
                urls: Twitter.Api.EmbeddedURL[];
            };

            url?: {
                urls: Twitter.Api.EmbeddedURL[];
            };
        };
        fast_followers_count!: number;
        favourites_count!: number;
        follow_request_sent!: boolean;
        followed_by!: boolean;
        followers_count!: number;
        following!: boolean;
        friends_count!: number;
        has_custom_timelines!: boolean;
        is_translator!: boolean;
        listed_count!: number;
        location!: string;
        media_count!: number;
        muting!: boolean;
        name!: string;
        normal_followers_count!: number;
        notifications!: boolean;
        pinned_tweet_ids_str!: string[];
        profile_banner_extensions!: {
            mediaColor: Twitter.Api.MediaColor;
        };
        profile_image_url_https!: string;
        profile_interstitial_type!: string;
        'protected'!: boolean;
        screen_name!: string;
        statuses_count!: number;
        translator_type!: 'none' | 'regular' | string;
        url!: string;
        verified!: boolean;
        want_retweets!: boolean;
        withheld_in_countries!: unknown[];

        readonly created_at!: Date;
        readonly updated_at!: Date;

        getTweets!: HasManyGetAssociationsMixin<Tweet>;
        addTweet!: HasManyAddAssociationMixin<Tweet, number>;
        hasTweet!: HasManyHasAssociationMixin<Tweet, number>;
        countTweets!: HasManyCountAssociationsMixin;
        createTweet!: HasManyCreateAssociationMixin<Tweet>;

        readonly tweets?: Tweet[];

        static associations: {
            tweets: Association<Author, Tweet>
        }
    }

    class CursorState extends Model<CursorSchema, CursorCreationSchema> implements CursorSchema {
        top!: string;
        bottom!: string;

        readonly created_at!: Date;
        readonly updated_at!: Date;
    }

    export interface Config {
        inMemory: boolean;
        storagePath?: string;
        logging: false | NonNullable<Options['logging']>;
    };

    export class Database {
        static readonly DEFAULT_DATABASE_NAME = 'twitter-bookmarks';
        static readonly DEFAULT_DATABASE_PATH = rootPathTo(`/${Database.DEFAULT_DATABASE_NAME}.db`);

        static readonly DEFAULT_CONFIG: Config = {
            inMemory: false,
            storagePath: Database.DEFAULT_DATABASE_PATH,
            logging: false
        };

        protected readonly db: Sequelize;

        constructor(
            readonly config: Config = Database.DEFAULT_CONFIG
        ) {
            const sequelizeOptions: Options = {
                dialect: 'sqlite',
            };

            if(config.inMemory)
                sequelizeOptions.storage = ':memory:';
            else {
                sequelizeOptions.storage = config.storagePath
                    ? config.storagePath
                    : Database.DEFAULT_CONFIG.storagePath;
            }

            sequelizeOptions.logging = config.logging
                ? config.logging
                : Database.DEFAULT_CONFIG.logging;

            this.db = new Sequelize(sequelizeOptions);

            // Init models
            this.defineModels();
            this.defineAssociations();
        }

        protected defineModels() {
            this.defineAuthor();
            this.defineTweet();
            this.defineCursor();
        }

        protected defineAuthor() {
            Author.init({
                created_at: {
                    type: DataTypes.DATE
                },

                updated_at: {
                    type: DataTypes.DATE
                },

                id_str: {
                    type: DataTypes.STRING(20),
                    primaryKey: true
                },

                created_date: {
                    type: DataTypes.DATE
                },

                blocked_by: {
                    type: DataTypes.BOOLEAN
                },

                blocking: {
                    type: DataTypes.BOOLEAN
                },

                can_dm: {
                    type: DataTypes.BOOLEAN
                },

                can_media_tag: {
                    type: DataTypes.BOOLEAN
                },

                default_profile: {
                    type: DataTypes.BOOLEAN
                },

                default_profile_image: {
                    type: DataTypes.BOOLEAN
                },

                description: {
                    type: DataTypes.STRING(160)
                },

                entities: {
                    type: DataTypes.JSON
                },

                fast_followers_count: {
                    type: DataTypes.INTEGER
                },

                favourites_count: {
                    type: DataTypes.INTEGER
                },

                follow_request_sent: {
                    type: DataTypes.BOOLEAN
                },

                followed_by: {
                    type: DataTypes.BOOLEAN
                },

                followers_count: {
                    type: DataTypes.INTEGER
                },

                following: {
                    type: DataTypes.BOOLEAN
                },

                friends_count: {
                    type: DataTypes.INTEGER
                },

                has_custom_timelines: {
                    type: DataTypes.BOOLEAN
                },

                is_translator: {
                    type: DataTypes.BOOLEAN
                },

                listed_count: {
                    type: DataTypes.INTEGER
                },

                location: {
                    type: DataTypes.STRING(30)
                },

                media_count: {
                    type: DataTypes.INTEGER
                },

                muting: {
                    type: DataTypes.BOOLEAN
                },

                // Names are up to 50 chars
                // https://help.twitter.com/en/managing-your-account/twitter-username-rules#:~:text=Your%20username%20cannot%20be%20longer,for%20the%20sake%20of%20ease.
                name: {
                    type: DataTypes.STRING(50)
                },

                normal_followers_count: {
                    type: DataTypes.INTEGER
                },

                notifications: {
                    type: DataTypes.BOOLEAN
                },

                pinned_tweet_ids_str: {
                    type: DataTypes.JSON
                },

                profile_banner_extensions: {
                    type: DataTypes.JSON
                },

                profile_image_url_https: {
                    type: DataTypes.TEXT
                },

                // Typically empty string, but could be something later?
                profile_interstitial_type: {
                    type: DataTypes.TEXT
                },

                'protected': {
                    type: DataTypes.BOOLEAN
                },

                // Usernames are up to 15 chars
                // https://help.twitter.com/en/managing-your-account/twitter-username-rules#:~:text=Your%20username%20cannot%20be%20longer,for%20the%20sake%20of%20ease.
                screen_name: {
                    type: DataTypes.STRING(15)
                },

                statuses_count: {
                    type: DataTypes.INTEGER
                },

                // Appears to be an enum, but there could be other accepted values undiscovered
                translator_type: {
                    type: DataTypes.STRING(16)
                },

                url: {
                    type: DataTypes.STRING(100)
                },

                verified: {
                    type: DataTypes.BOOLEAN
                },

                want_retweets: {
                    type: DataTypes.BOOLEAN
                },

                withheld_in_countries: {
                    type: DataTypes.JSON
                },
            }, {
                sequelize: this.db,
                underscored: true,
                tableName: 'authors',
                indexes: [{
                    fields: ['id_str'],
                    unique: true
                }, {
                    fields: ['screen_name'],
                    unique: true
                }]
            });
        }

        protected defineTweet() {
            Tweet.init({
                created_at: {
                    type: DataTypes.DATE
                },

                updated_at: {
                    type: DataTypes.DATE
                },

                id_str: {
                    type: DataTypes.STRING(20),
                    primaryKey: true
                },

                author_id_str: {
                    type: DataTypes.STRING(20),
                },

                created_date: {
                    type: DataTypes.DATE
                },

                conversation_id_str: {
                    type: DataTypes.STRING(20)
                },

                self_thread_id_str: {
                    type: DataTypes.STRING(20),
                    allowNull: true
                },

                display_text_range: {
                    type: DataTypes.JSON
                },

                entities: {
                    type: DataTypes.JSON
                },

                extended_entities: {
                    type: DataTypes.JSON
                },

                favorite_count: {
                    type: DataTypes.INTEGER
                },

                favorited: {
                    type: DataTypes.BOOLEAN
                },

                full_text: {
                    type: DataTypes.TEXT
                },

                is_quote_status: {
                    type: DataTypes.BOOLEAN
                },

                lang: {
                    type: DataTypes.CHAR(2)
                },

                possibly_sensitive: {
                    type: DataTypes.BOOLEAN
                },

                possibly_sensitive_editable: {
                    type: DataTypes.BOOLEAN
                },

                reply_count: {
                    type: DataTypes.INTEGER
                },

                retweet_count: {
                    type: DataTypes.INTEGER
                },

                retweeted: {
                    type: DataTypes.BOOLEAN
                },

                source: {
                    type: DataTypes.TEXT
                }
            }, {
                sequelize: this.db,
                underscored: true,
                tableName: 'bookmarked_tweets',
                indexes: [{
                    fields: ['id_str'],
                    unique: true
                }]
            });
        }

        protected defineCursor() {
            CursorState.init({
                created_at: {
                    type: DataTypes.DATE
                },

                updated_at: {
                    type: DataTypes.DATE
                },

                // Cursor are 18 chars
                top: {
                    type: DataTypes.STRING(20)
                },

                bottom: {
                    type: DataTypes.STRING(20)
                }
            }, {
                sequelize: this.db,
                underscored: true,
                tableName: 'cursor_state'
            });
        }

        protected defineAssociations() {
            Author.hasMany(Tweet, {
                sourceKey: 'id_str',
                foreignKey: 'author_id_str',
                'as': 'tweets'
            });

            Tweet.belongsTo(Author, {
                foreignKey: 'id_str'
            });
        }

        init() {
            return this.db.sync();
        }

        static separateTweetsAndAuthors(tweets: Application.Tweet[]): Application.TweetsAndAuthors {
            const tweetsAndAuthors: Application.TweetsAndAuthors = {
                tweets: [],
                authors: []
            };

            tweets.forEach(tweet => {
                tweetsAndAuthors.tweets.push(tweet);
                tweetsAndAuthors.authors.push(tweet.author);
            });

            return tweetsAndAuthors;
        }

        async insertTweets(tweets: Application.Tweet[]) {
            const insertTxn = await this.db.transaction();
            const {
                authors
            } = Database.separateTweetsAndAuthors(tweets);

            // TODO if new data for a tweet/author is null, should it be erased?
            // Who decides this?
            try {
                await Promise.all([
                    Author.bulkCreate(authors),
                    Tweet.bulkCreate(tweets)
                ]);

                await insertTxn.commit();
            } catch(err) {
                await insertTxn.rollback();
            }
        }

        async getCursorState() {
            // There should only be one
            return CursorState.findOne();
        }

        async persistCursorState(cursor: Application.Cursor) {
            const upsertTxn = await this.db.transaction();

            await CursorState.upsert(cursor);

            try {
                await upsertTxn.commit();
            } catch(err) {
                await upsertTxn.rollback();
            }
        }

        async getTweetById(id: string) {
            return Tweet.findByPk(id);
        }

        async getTweetAuthor(tweet: Application.Tweet | Tweet) {
            const authorId = tweet.author_id_str;
            return Author.findByPk(authorId);
        }

        async shutDown() {
            return this.db.close();
        }
    }
}
