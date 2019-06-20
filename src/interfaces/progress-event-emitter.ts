import { EventEmitter } from 'events';
import StrictEventEmitter from 'strict-event-emitter-types';

import EventCompleteRatio from './event-complete-ratio';

interface ProgressEvents {
    progress: (event: ProgressEvent) => void;
    message: (event: MessageEvent) => void;
}

type StrictProgressEventEmitter
    = StrictEventEmitter<EventEmitter, ProgressEvents>;

const ExtendableProgressEventEmitter =
    (EventEmitter as { new(): StrictProgressEventEmitter });

export default abstract class ProgressEventEmitter extends ExtendableProgressEventEmitter {
    protected emitProgressEvent(eventName: string, eventCompleteRatio?: EventCompleteRatio) {
        const progressEvent = new ProgressEvent(eventName, eventCompleteRatio);
        this.emit('progress', progressEvent);
    }

    protected emitMessageEvent(message: string) {
        const messageEvent = new MessageEvent(message);
        this.emit('message', messageEvent);
    }
}

export abstract class ProgressableEvent {
    protected constructor(
        protected readonly name: keyof ProgressEvents
    ) {}

    public handle(eventEmitter: ProgressEventEmitter) {
        eventEmitter.emit(<any> this.name, this);
    };
}

export class ProgressEvent extends ProgressableEvent {
    constructor(
        public readonly eventName: string,
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
