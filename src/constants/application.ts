import rootPathTo from '../utils/root-path-to';

import { Twitter } from './twitter';
import { TweetsDB } from '../client/tweets-db';

export namespace Application {
    export interface Tweet
    extends Omit<Twitter.Api.Tweet, 'self_thread' | 'user_id_str' | 'created_at'> {
        author: User;
        author_id_str: string;
        created_date: Date;
        self_thread_id_str?: string;
    }

    export interface User
    extends Omit<Twitter.Api.User, 'created_at'> {
        id_str: string;
        created_date: Date;
    }

    export interface TweetsAndAuthors {
        tweets: Application.Tweet[];
        authors: Application.User[];
    }

    export interface Cursor {
        top: string;
        bottom: string;
    }

    export namespace Defaults {
        export const DEBUG_LOG_FILENAME = rootPathTo('/logs/debug.log');

        export const DATABASE_NAME = 'twitter-bookmarks';
        export const DATABASE_PATH = rootPathTo(`/${DATABASE_NAME}.db`);
        export const DB_CONFIG: TweetsDB.Config = {
            inMemory: false,
            storagePath: DATABASE_PATH
        };
    }
}
