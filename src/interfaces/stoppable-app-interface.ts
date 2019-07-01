import AppInterface from './app-interface';

export default abstract class StoppableAppInterface extends AppInterface {
    public async run(stringArgs: string[] = process.argv.slice(2)) {
        this.startWatchingForStopSignal();
        await this.runExtractionTask(stringArgs);
    }

    protected async stop(completed: boolean) {
        this.stopExtractionTaskHooks();
        await this.stopExtractionTask();
    }

    protected async stopExtractionTask(completed: boolean) {
        await this.extractionTask
            .mapAsync(task => task.stop(completed))

        this.handleSuccess();
    }

    public async stopAsIncomplete() {
        return this.stop(false);
    }

    protected async onTaskComplete() {
        return this.stop(true);
    }

    protected abstract startWatchingForStopSignal(): void;
    protected abstract stopWatchingForStopSignal(): void;
}
