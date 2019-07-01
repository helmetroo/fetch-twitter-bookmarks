import { EventEmitter } from 'events';
import StrictEventEmitter from 'strict-event-emitter-types';
import { injectable as Injectable, decorate as Decorate } from 'inversify';

import EventCompleteRatio from './event-complete-ratio';

// Line below necessary to work with inversify. :( See https://github.com/inversify/InversifyJS/issues/997#issuecomment-491808863
Object.getPrototypeOf(EventEmitter.prototype).constructor = Object;

interface ProgressEvents {
    progress: (event: ProgressEvent) => void;
    message: (event: MessageEvent) => void;
}

type ProgressEventCategories = keyof ProgressEvents;

type StrictProgressEventEmitter
    = StrictEventEmitter<EventEmitter, ProgressEvents>;

const ExtendableProgressEventEmitter =
    (EventEmitter as { new(): StrictProgressEventEmitter });

Decorate(Injectable(), EventEmitter);
@Injectable()
export default abstract class ProgressEventEmitter extends ExtendableProgressEventEmitter {
    protected emitProgressEvent(name: string, eventCompleteRatio?: EventCompleteRatio) {
        const progressEvent = new ProgressEvent(name, eventCompleteRatio);
        this.emit('progress', progressEvent);
    }

    protected emitMessageEvent(message: string) {
        const messageEvent = new MessageEvent(message);
        this.emit('message', messageEvent);
    }

    protected pipeEventsFrom(orig: ProgressEventEmitter) {
        const oldEmit = orig.emit;

        const self = this;
        const newEmit: typeof oldEmit = function(...args: Parameters<typeof oldEmit>) {
            oldEmit.apply(orig, args);
            self.emit.apply(self, args);
        };

        orig.emit = newEmit;
    }
}

export abstract class ProgressableEvent {
    protected constructor(
        protected readonly category: ProgressEventCategories
    ) {}
}

export class ProgressEvent extends ProgressableEvent {
    constructor(
        public readonly name: string,
        public readonly eventCompleteRatio?: EventCompleteRatio
    ) {
        super('progress');
    }
}

export class MessageEvent extends ProgressableEvent {
    constructor(
        public readonly message: string
    ) {
        super('message');
    }
}
