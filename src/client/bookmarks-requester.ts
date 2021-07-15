import type { URL, URLSearchParams } from 'url';
import superagent from 'superagent';
import { TypedEmitter } from 'tiny-typed-emitter';

import { Twitter } from '../constants/twitter';
import { Application } from '../constants/application';
import DataExtractor from './data-extractor';
import { ApplicationError, TwitterHttpRequestError } from '../constants/error';

export namespace BookmarksRequester {
    export interface Config {
        reqUrl: URL;
        reqHeader: Twitter.Api.PlaywrightHeader;
        initialCursor: Application.Cursor;
    }

    export interface ConfigWithBookmarks extends Config {
        initialBookmarks: Application.Tweet[]
    }

    export interface RequesterEvents {
        http: (url: string, method: string, params: URLSearchParams, header: Twitter.Api.RequestHeader) => void;
        fetched: (cursor: Application.Cursor, bookmarks: Application.Tweet[]) => void;
        error: (error: ApplicationError) => void;
        end: () => void;
    }

    export class Requester extends TypedEmitter<RequesterEvents> {
        protected url: URL;
        protected header: Twitter.Api.RequestHeader;

        protected currentCursor: Application.Cursor;
        protected reachedEnd: boolean = false;

        protected requestedStop: boolean = false;
        protected halted: boolean = false;

        static readonly DELAY: number = 350;

        protected get canFetch() {
            return !this.reachedEnd
                && !this.requestedStop
                && !this.halted;
        }

        constructor(
            config: BookmarksRequester.Config
        ) {
            super();

            this.url = config.reqUrl;
            this.header = Requester.toSuperagentHeader(config.reqHeader);
            this.currentCursor = config.initialCursor;
        }

        startRequestLoop() {
            // TODO we need to be careful not to make too many requests too quickly,
            // but also fetch as many as quickly as possible
            this.requestedStop = false;
            this.halted = false;
            this.timeoutRequest(true);
        }

        protected timeoutRequest(immediately = false) {
            const delay = (immediately) ? 0 : Requester.DELAY;
            setTimeout(this.request.bind(this), delay);
        }

        protected async request() {
            try {
                const response = await this.fetchBookmarks();
                const extractor = new DataExtractor(response);
                const {
                    cursor,
                    tweets
                } = extractor;

                this.emit('fetched', cursor, tweets);

                this.reachedEnd = this.currentCursor.bottom === cursor.bottom;
                if(this.reachedEnd)
                    this.emit('end');
            } catch(err) {
                this.emit('error', err);

                this.halted = true;
            } finally {
                if(this.canFetch)
                    this.timeoutRequest();
            }
        }

        protected async fetchBookmarks() {
            const reqParams = this.url.searchParams;
            const reqSearchVars = <Twitter.Api.SearchParams>
                JSON.parse(reqParams.get('variables')!);
            reqSearchVars.cursor = this.currentCursor.bottom;
            reqParams.set('variables', JSON.stringify(reqSearchVars));

            const reqUrlStr = this.url.toString();

            // TODO user-agent header includes "headless" (may want to remove?)
            const req = superagent
                .get(reqUrlStr)
                .set(this.header);

            this.emitHttp(reqUrlStr, req.method, reqParams, this.header);

            let res: superagent.Response;
            try {
                res = await req;
            } catch(err) {
                const reqWithHeaders = {
                    ...req,
                    headers: this.header
                };

                throw TwitterHttpRequestError.fromSuperagent(err, reqWithHeaders);
            }

            return <Twitter.Api.SuccessResponse> res.body;
        }

        protected static toSuperagentHeader(header: Twitter.Api.RequestHeader): Twitter.Api.RequestHeader {
            const superagentHeader: Twitter.Api.PlaywrightHeader = {...header};

            delete superagentHeader[':method'];
            delete superagentHeader[':authority'];
            delete superagentHeader[':scheme'];
            delete superagentHeader[':path'];
            superagentHeader['cache-control'] = 'no-cache';

            return superagentHeader;
        }

        protected emitHttp(url: string, method: string, params: URLSearchParams, header: Twitter.Api.RequestHeader) {
            this.emit('http', url, method, params, header);
        }

        stopRequestLoop() {
            this.requestedStop = true;
        }
    }
}
