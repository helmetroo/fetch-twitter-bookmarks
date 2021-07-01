import { workerData, parentPort } from 'worker_threads';
import { BookmarksRequester } from './bookmarks-requester';

class BookmarksRequesterWorker {
    protected requester: BookmarksRequester.Requester;

    constructor(
        protected config: BookmarksRequester.Config
    ) {
        this.requester = new BookmarksRequester.Requester(config);
    }

    start() {
        this.requester.start();
    }

    stop() {
        this.requester.stop();
    }

    watchForRequesterEvents() {
        this.requester.on('fetched', this.notifyParent('fetched'));
        this.requester.on('end', this.notifyParent('end'));
        this.requester.on('error', this.notifyParent('error'));
    }

    watchForParentMessages() {
        parentPort?.on('stop', this.stop.bind(this));
    }

    protected notifyParent(eventName: string) {
        return function() {
            parentPort?.postMessage({
                eventName
            });
        }
    }
}

const config = <BookmarksRequester.Config> workerData;
const worker = new BookmarksRequesterWorker(config);
worker.start();
