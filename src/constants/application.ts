import { Twitter } from './twitter';

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
}
