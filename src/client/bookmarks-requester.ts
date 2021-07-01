import type { URL } from 'url';
import superagent from 'superagent';
import { TypedEmitter } from 'tiny-typed-emitter';

import { Twitter } from '../constants/twitter';
import { Application } from '../constants/application';
import DataExtractor from './data-extractor';
import { TweetsDB } from './tweets-db';

export namespace BookmarksRequester {
    export interface Config {
        reqUrl: URL;
        reqHeader: Twitter.Api.RequestHeader;
        initialCursor?: string;
        initialBookmarks?: Application.Tweet[];
    }

    export interface RequesterEvents {
        fetched: (fetched: Application.Tweet[]) => void;
        error: (message: string) => void;
        end: () => void;
    }

    export class Requester extends TypedEmitter<RequesterEvents> {
        protected reachedEnd: boolean = false;
        protected requestedStop: boolean = false;

        get atEnd() {
            return this.reachedEnd;
        }

        set atEnd(reachedEnd: boolean) {
            this.reachedEnd = reachedEnd;
        }

        get stopped() {
            return this.requestedStop;
        }

        constructor(
            protected config: BookmarksRequester.Config,
            protected db: TweetsDB.Database
        ) {
            super();
        }

        start() {
            const keepGoing = !this.atEnd && !this.stopped;
            while(keepGoing) {
                this.requestBookmarks();
            }
        }

        protected async requestBookmarks() {
            const res = await this.download();
            this.updateState(res);
        }

        stop() {
            this.requestedStop = true;
        }

        protected async download() {
            const {
                reqUrl,
                reqHeader
            } = this.config;

            const reqParams = reqUrl.searchParams;
            const reqSearchVars = <Twitter.Api.SearchParams>
                JSON.parse(reqParams.get('variables')!);
            reqSearchVars.cursor = this.cursor;
            reqParams.set('variables', JSON.stringify(reqSearchVars));

            const reqUrlStr = reqUrl.toString();
            const res = await superagent.get(reqUrlStr)
                .set(reqHeader);
            const resBody = <Twitter.Api.Response> res.body();
            const resBodyAsError = <Twitter.Api.ErrorResponse> resBody;
            if(resBodyAsError.errors) {
                const errorMessage = resBodyAsError.errors[0]!.message;
                this.emit('error', `Unable to fetch bookmarks. Reason given by Twitter: ${errorMessage}`);
            }

            return <Twitter.Api.SuccessResponse> res;
        }

        protected updateState(response: Twitter.Api.SuccessResponse) {
            const dataExtractor = new DataExtractor(response);
            this.atEnd = this.cursor === dataExtractor.cursor.bottom;
            if(this.atEnd) {
                this.emit('end');
                return;
            }

            this.persistState(dataExtractor);
        }

        protected async persistState(dataExtractor: DataExtractor) {
            await this.db.persistCursorState(dataExtractor.cursor);
            await this.db.insertTweets(dataExtractor.tweets);
        }
    }
}
