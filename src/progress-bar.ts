import { Bar, Presets } from 'cli-progress';

import ProgressEventEmitter from './interfaces/progress-event-emitter';

export default class ProgressBar {
    protected progressBar: Bar =
        new Bar({}, Presets.shades_classic);

    protected achievedEvents: number = 0;

    constructor(private watchable: ProgressEventEmitter) {}

    public startWatching() {
        this.progressBar.start(this.watchable.numEvents, 0);
        this.watchable.on('progress', this.updateProgress.bind(this));
    }

    protected updateProgress(eventName: string) {
        ++this.achievedEvents;
        console.log(eventName);
        this.progressBar.update(this.achievedEvents);
    } 

    public stopWatching() {
        this.progressBar.stop();
        this.watchable.off('progress', this.updateProgress);
    }
}
