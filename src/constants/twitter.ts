import { URL } from 'url';
import { stringify } from 'querystring';

export namespace Twitter {
    export namespace Url {
        export const PATHNAMES = {
            loggedOut: '/',
            home: '/home',
            logIn: '/login',
            logInError: '/login/error',
            logOut: '/logout',
            bookmarks: '/i/bookmarks',
            challengeCode: '/account/login_challenge',
            twoFaCode: '/account/2fa_challenge', // TODO probably NOT correct path!!!
        };

        export const PATH_REGEXES = {
            bookmarks: /\/i\/api\/graphql\/.*\/Bookmarks/
        };

        const BASE_URL = 'https://twitter.com';

        function buildTwitterUrlWithOpts(def: Partial<URL>) {
            const twitterUrlDef = new URL(BASE_URL);
            Object.assign(twitterUrlDef, def);

            return twitterUrlDef.toString();
        }

        export const LOGIN = buildTwitterUrlWithOpts({
            pathname: PATHNAMES.logIn
        });

        export const BOOKMARKS = buildTwitterUrlWithOpts({
            pathname: PATHNAMES.bookmarks,
        });

        export const LOGOUT = buildTwitterUrlWithOpts({
            pathname: PATHNAMES.logOut
        });
    }

    export namespace Selectors {
        export const LOGIN_PAGE = {
            usernameInput: 'input[name="session[username_or_email]"]',
            passwordInput: 'input[name="session[password]"]',
            submitButton: 'div[data-testid="LoginForm_Login_Button"]'
        };

        export const CONFIRMATION_CODE_PAGE = {
            codeInput: 'input[name="challenge_response"]',
            submitButton: 'input[type="submit"]'
        };

        export const LOGOUT_PAGE = {
            confirmButton: 'div[data-testid="confirmationSheetConfirm"]'
        };
    }

    export namespace Api {
        export interface RequestHeader {
            accept: string;
            'accept-language': string;
            authorization: string;
            'cache-control': 'no-cache';
            'content-type': 'application/json';
            pragma: 'no-cache';
            'sec-ch-ua': string;
            'sec-ch-ua-mobile': string;
            'sec-fetch-dest': 'empty';
            'sec-fetch-mode': 'cors';
            'sec-fetch-site': 'same-origin';
            'x-csrf-token': string;
            'x-twitter-active-user': 'yes';
            'x-twitter-auth-type': 'OAuth2Session';
            'x-twitter-client-language': string;
            cookie: string;
        }

        export type Response = SuccessResponse | ErrorResponse;

        export interface SuccessResponse {
            data: {
                bookmark_timeline: {
                    timeline: {
                        instructions: TimelineInstructions[] // Most likely only contains 1
                        responseInstructions: {
                            feedbackActions: unknown[]
                        }
                    }
                }
            }
        }

        export interface ErrorResponse {
            errors: Error[]
        };

        export interface Error {
            code: number;
            message: string;
        };

        export interface TimelineInstructions {
            'type': 'TimelineAddEntries';
            entries: TimelineEntries;
        }

        export type TimelineEntries = [
            ...TweetEntry[],
            CursorTopEntry,
            CursorBottomEntry
        ];

        export interface TimelineEntry {
            entryId: string;
            sortIndex: string;
            content: {
                entryType: string;
            };
        }

        // entryId begins with "tweet"
        export interface TweetEntry extends TimelineEntry {
            content: {
                entryType: 'TimelineTimelineItem';
                itemContent: {
                    itemType: 'TimelineTweet';
                    tweetDisplayType: 'Tweet';
                    tweet_results: {
                        result: {
                            __typename: 'Tweet';
                            rest_id: number;
                            core: {
                                user: UserSchema;
                            };
                            legacy: Tweet;
                        };
                    };
                }
            }
        }

        // entryId begins with "cursor-top" | "cursor-bottom".
        export interface CursorEntry extends TimelineEntry {
            content: {
                entryType: 'TimelineTimelineCursor';
                value: string;
                stopOnEmptyResponse?: boolean;
            };
        }

        export interface CursorTopEntry extends CursorEntry {
            content: CursorEntry['content'] & {
                cursorType: 'Top';
            };
        }

        export interface CursorBottomEntry extends CursorEntry {
            content: CursorEntry['content'] & {
                cursorType: 'Bottom';
            };
        }

        export interface Schema {
            id: string; // base64 encoded; follows pattern "Entity:number"
            rest_id: string;
        }

        export interface Tweet {
            created_at: string; // Date
            conversation_id_str: string;
            display_text_range: number[];
            entities: {
                media: Media[];
                user_mentions: unknown[];
                urls: unknown[];
                hashtags: unknown[];
                symbols: unknown[];
            };
            favorite_count: number;
            favorited: boolean;
            full_text: string;
            is_quote_status: boolean;
            lang: string;
            reply_count: number;
            retweet_count: number;
            retweeted: false;
            source: string; // valid HTML
            user_id_str: string;
            id_str: string;
            self_thread: {
                id_str: string;
            };
        }

        export interface EmbeddedURL {
            display_url: string;
            expanded_url: string;
            url: string;
            indices: number[];
        }

        export interface UserSchema extends Schema {
            legacy: User;
        }

        export interface User {
            blocked_by: boolean;
            blocking: boolean;
            can_dm: boolean;
            can_media_tag: boolean;
            created_at: string;
            default_profile: boolean;
            default_profile_image: boolean;
            description: string;
            entities: {
                description: {
                    urls: EmbeddedURL[];
                };

                url: {
                    urls: EmbeddedURL[];
                };
            };
            fast_followers_count: number;
            favourites_count: number;
            follow_request_sent: boolean;
            followed_by: boolean;
            followers_count: number;
            following: boolean;
            friends_count: number;
            has_custom_timelines: boolean;
            is_translator: boolean;
            listed_count: number;
            location: string;
            media_count: number;
            muting: boolean;
            name: string;
            normal_followers_count: number;
            notifications: boolean;
            pinned_tweet_ids_str: string[];
            profile_banner_extensions: {
                mediaColor: MediaColor;
            };
            profile_image_url_https: string;
            profile_interstitial_type: string;
            'protected': boolean;
            screen_name: string;
            statuses_count: number;
            translator_type: string;
            url: string;
            verified: boolean;
            want_retweets: boolean;
            withheld_in_countries: unknown[];
        };

        export interface Media extends EmbeddedURL {
            media_url_https: string;
            type: 'photo' | string;
            url: string;
            features: {
                small: MediaFeature;
                medium: MediaFeature;
                large: MediaFeature;
                orig: MediaFeature;
            };
            sizes: {
                large: ResizeInfo;
                medium: ResizeInfo;
                small: ResizeInfo;
                thumb: ResizeInfo;
            };
            original_info: {
                height: number;
                width: number;
                focus_rects: Box[];
            };
        };

        export interface MediaFeature {
            faces: Box[]
        };

        export interface Box {
            x: number;
            y: number;
            h: number;
            w: number;
        };

        export interface ResizeInfo {
            h: number;
            w: number;
            resize: 'fit' | 'crop' | string;
        };

        export interface MediaColor {
            r: {
                ok: {
                    palette: Color[];
                }
            }
        };

        export interface Color {
            percentage: number;
            rgb: {
                red: number;
                green: number;
                blue: number;
            };
        };
    }
}
