import { EventEmitter } from 'events';

import EventCompleteRatio from './event-complete-ratio';

export default abstract class ProgressEventEmitter extends EventEmitter {
    protected emitProgressEvent(eventName: string, eventCompleteRatio?: EventCompleteRatio) {
        this.emit('progress', eventName, eventCompleteRatio);
    }

    protected emitMessageEvent(message: string) {
        this.emit('message', message);
    }
}
