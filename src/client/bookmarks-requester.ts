import type { URL } from 'url';
import superagent from 'superagent';
import { TypedEmitter } from 'tiny-typed-emitter';

import { Twitter } from '../constants/twitter';
import { Application } from '../constants/application';
import DataExtractor from './data-extractor';
import { ConnectionError, TwitterRequestError } from '../constants/error';

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
        fetched: (cursor: Application.Cursor, bookmarks: Application.Tweet[]) => void;
        log: (message: string) => void;
        error: (message: string) => void;
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
                if(err instanceof TwitterRequestError) {
                    this.emit('error', `Reason given by Twitter: ${err.message}`);
                } else {
                    this.emit('error', `There may be a connection issue. Error thrown: ${err.message}`);
                }

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
            this.logRequest(reqUrlStr, this.header);

            // TODO user-agent header includes "headless" (may want to remove?)
            let res: superagent.Response;
            try {
                res = await superagent.get(reqUrlStr)
                    .set(this.header)
                    .buffer(true)
                    .parse(({text}) => {
                        try {
                            this.log('Response raw body: ${text}');
                            return JSON.parse(<string> text);
                        } catch(err) {
                            this.emit('error', 'There was a problem parsing JSON');
                            return {};
                        }
                    })
            } catch(err) {
                throw new ConnectionError(err.message);
            }

            const resBody = <Twitter.Api.Response> res.body;
            const resBodyAsError = <Twitter.Api.ErrorResponse> resBody;
            if(resBodyAsError.errors) {
                const errorMessage = resBodyAsError.errors[0]!.message;
                throw new TwitterRequestError(errorMessage);
            }

            return <Twitter.Api.SuccessResponse> (res as unknown);
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

        protected log(message: string) {
            this.emit('log', message);
        }

        protected logRequest(url: string, header: Twitter.Api.RequestHeader) {
            this.log(`Submitting GET request to ${url} with headers ${JSON.stringify(header)}`);
        }

        stopRequestLoop() {
            this.requestedStop = true;
        }
    }
}
