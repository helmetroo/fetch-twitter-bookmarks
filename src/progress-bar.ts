import Progress from 'progress';

import Progressable from './interfaces/progressable';
import EventCompleteRatio from './interfaces/event-complete-ratio';

export default class ProgressBar {
    protected static readonly PROGRESS_BAR_FORMAT: string =
        ':eventName :bar :percent ETA :etas';

    protected progressBar: Progress;
    protected eventsComplete: number = 0;
    protected totalEvents: number;

    constructor(private progressable: Progressable) {
        this.totalEvents = this.progressable.numEvents;
        this.progressBar = new Progress(ProgressBar.PROGRESS_BAR_FORMAT, {
            total: this.totalEvents,
            width: 36
        });
    }

    public startWatching() {
        this.progressable.on('progress', this.updateProgress.bind(this));
        this.progressable.on('message', this.showMessage.bind(this));
    }

    protected updateProgress(eventName: string, eventCompleteRatio?: EventCompleteRatio) {
        if(eventCompleteRatio) {
            const currentProgressPercent =
                (this.eventsComplete + eventCompleteRatio.complete) / this.totalEvents;

            this.progressBar.update(currentProgressPercent, {
                eventName
            });
            return;
        }

        this.eventsComplete++;
        this.progressBar.tick({
            eventName
        });
    }

    public stopWatching() {
        this.progressBar.terminate();

        this.progressable.off('progress', this.updateProgress.bind(this));
        this.progressable.off('message', this.showMessage.bind(this));
    }

    public showMessage(message: string) {
        this.progressBar.interrupt(message);
    }
}
