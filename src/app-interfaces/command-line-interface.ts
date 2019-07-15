import { inject as Inject, injectable as Injectable } from 'inversify';

import AppInterface from '@app-interfaces/app-interface';

import ExtractionTask from '@extraction-task/extraction-task';
import ExtractionTaskCreator from '@extraction-task/extraction-task-creator';

import { MessageEvent } from '@interfaces/progress-event-emitter';
import Maybe from '@interfaces/maybe';

import ProgressBar from '../progress-bar';

import IOC_TOKENS from '@ioc-tokens';
const {
    ExtractionTaskCreator: ExtractionTaskCreatorType,
} = IOC_TOKENS;

@Injectable()
export default class CommandLineInterface extends AppInterface {
    protected extractionTask: Maybe<ExtractionTask> =
        Maybe.none<ExtractionTask>();

    protected progressBar: Maybe<ProgressBar> =
        Maybe.none<ProgressBar>();

    protected static readonly END_SIGNALS: NodeJS.Signals[] = [
        'SIGINT',
        'SIGTERM',
        'SIGHUP'
    ];

    constructor(
        @Inject(ExtractionTaskCreatorType)
        private readonly extractionTaskCreator: ExtractionTaskCreator
    ) {
        super();
    }

    protected startWatchingForStopSignal() {
        for(const signal of CommandLineInterface.END_SIGNALS)
            process.on(signal, this.stopIncomplete.bind(this));
    }

    protected stopWatchingForStopSignal() {
        for(const signal of CommandLineInterface.END_SIGNALS)
            process.off(signal, this.stopIncomplete.bind(this));
    }

    protected startProgressBar(extractionTask: ExtractionTask) {
        const progressBar = new ProgressBar(extractionTask);
        this.progressBar = Maybe.fromValue(progressBar);
        progressBar.startWatching();
    }

    protected stopProgressBar() {
        this.progressBar
            .map(progressBar => progressBar.stopWatching());
    }

    public async stopIncomplete() {
        return this.stop(false);
    }

    public async run() {
        const extractionTask = await this.extractionTaskCreator.create();
        this.extractionTask = Maybe.fromValue(extractionTask);

        const successCallback = this.onExtractionTaskComplete.bind(this);
        extractionTask.setSuccessCallback(successCallback);

        const errorCallback = this.exitWithError.bind(this);
        extractionTask.setErrorCallback(errorCallback);

        this.startProgressBar(extractionTask);
        extractionTask.run();
    }

    protected async stop(completed: boolean) {
        this.stopProgressBar();
        await this.stopExtractionTask(completed);
        this.exitWithSuccess();
    }

    protected async stopExtractionTask(completed: boolean) {
        await this.extractionTask.mapAsync(
            task => task.stop(completed)
        );
    }

    protected async onExtractionTaskComplete() {
        return this.stop(true);
    }

    protected exitWithSuccess() {
        process.exit(0);
    }

    protected exitWithError(err: Error) {
        const exitMessage =
            this.progressBar.map(
                progressBar =>
                    (message: string) => {
                        const messageEvent = new MessageEvent(message);
                        progressBar.showMessage(messageEvent);
                    }
            )
            .getOrElse(
                (message: string) => console.error(message)
            );

        exitMessage(err.message);
        process.exit(1);
    }
}
