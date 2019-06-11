import { EventEmitter } from 'events';

export default abstract class ProgressEventEmitter extends EventEmitter {
    protected PROGRESS_EVENTS: string[] = [];

    get events() {
        return this.PROGRESS_EVENTS;
    }

    get numEvents() {
        return this.PROGRESS_EVENTS.length;
    }

    protected emitProgressEvent(eventName: string) {
        this.emit('progress', eventName);
    } 
}
