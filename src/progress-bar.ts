import { Bar as CLIProgressBar, Presets } from 'cli-progress';
import { cyan } from 'colors';

import Progressable from './interfaces/progressable';
import EventCompleteRatio from './interfaces/event-complete-ratio';
import { ProgressEvent, MessageEvent } from './interfaces/progress-event-emitter';

export default class ProgressBar {
    protected static readonly PROGRESS_BAR_FORMAT: string =
        `${cyan('{bar}')} {percentage}% | {eventName} | ETA {eta}s | {value} / {total}`;

    protected progressBar: CLIProgressBar;

    protected lastCompleteRatio: EventCompleteRatio = {
        complete: 0,
        total: 0
    };
    protected lastEventName: string = '';

    protected eventsComplete: number = 0;
    protected totalEvents: number;

    protected watching: boolean = false;

    constructor(protected progressable: Progressable) {
        this.totalEvents = this.progressable.numEvents;
        this.progressBar = new CLIProgressBar({
            format: ProgressBar.PROGRESS_BAR_FORMAT,
            barsize: 36
        }, Presets.shades_grey);
    }

    public startWatching() {
        this.progressable.on('progress', this.updateProgress.bind(this));
        this.progressable.on('message', this.showMessage.bind(this));

        this.progressBar.start(this.totalEvents, 0, {
            eventName: 'starting',
        });

        this.watching = true;
    }

    protected updateProgress(progressEvent: ProgressEvent) {
        const {
            name,
            eventCompleteRatio
        } = progressEvent;

        this.lastEventName = name;

        if(eventCompleteRatio) {
            const diffEventsComplete =
                eventCompleteRatio.complete - this.lastCompleteRatio.complete;

            this.eventsComplete += diffEventsComplete;
            this.lastCompleteRatio = eventCompleteRatio;

            if(diffEventsComplete > 0)
                this.updateBar(this.eventsComplete, name);

            return;
        }

        this.updateBar(++this.eventsComplete, name);
    }

    protected updateBar(newValue: number, eventName: string) {
        this.progressBar.update(newValue, {
            eventName
        });
    }

    public stopWatching() {
        this.progressBar.stop();

        this.progressable.off('progress', this.updateProgress.bind(this));
        this.progressable.off('message', this.showMessage.bind(this));

        this.watching = false;
    }

    public showMessage(messageEvent: MessageEvent) {
        const {
            message
        } = messageEvent;

        if(!this.watching) {
            console.warn(message);
            return;
        }

        // Progress bar must be stopped to allow a message to be shown
        this.progressBar.stop();
        console.warn(message);
        this.progressBar.start(this.totalEvents, this.eventsComplete, {
            eventName: this.lastEventName
        });
    }
}
