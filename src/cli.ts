import CommandLineArgs from './interfaces/command-line-args';
import UsernamePasswordCredentials from './interfaces/username-password-credentials';
import ValidUsernamePasswordCredentials from './interfaces/valid-username-password-credentials';
import { MessageEvent } from './interfaces/progress-event-emitter';
import Maybe from './interfaces/maybe';
import StoppableAppInterface from './interfaces/stoppable-app-interface';

import CredentialsPrompter from './credentials-prompter';
import ProgressBar from './progress-bar';

export default class CommandLineInterface extends StoppableAppInterface {
    protected progressBar: Maybe<ProgressBar> =
        Maybe.none<ProgressBar>();

    protected static readonly END_SIGNALS: NodeJS.Signals[] = [
        'SIGINT',
        'SIGTERM',
        'SIGHUP'
    ]

    protected static async requestCredentials(cmdLineArgs: CommandLineArgs) {
        const credentialsPrompter = new CredentialsPrompter();
        return credentialsPrompter.prompt(incomingCredentials);
    }

    protected handleSuccess() {
        return process.exit(0);
    }

    protected handleError(err: Error) {
        const exitMessage =
            this.progressBar.map(
                progressBar =>
                    (message: string) => {
                        const messageEvent = new MessageEvent(message);
                        progressBar.showMessage(messageEvent);
                    }
            )
            .getOrElse((message: string) => console.error(message));

        exitMessage(err.message);
        return process.exit(1);
    }

    protected startWatchingForStopSignal() {
        for(const signal of TestInterface.END_SIGNALS)
            process.on(signal, this.stopAsIncomplete.bind(this));
    }

    protected stopWatchingForStopSignal() {
        for(const signal of TestInterface.END_SIGNALS)
            process.off(signal, this.stopAsIncomplete.bind(this));
    }

    protected startExtractionTaskHooks() {
        const progressBar = new ProgressBar(extractionTask);
        this.progressBar = Maybe.some(progressBar);
        progressBar.startWatching();
    }

    protected stopExtractionTaskHooks() {
        this.progressBar
            .map(progressBar => progressBar.stopWatching());
    }
}
