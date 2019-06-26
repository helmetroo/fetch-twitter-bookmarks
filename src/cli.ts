import minimist from 'minimist';

import CommandLineArgs from './interfaces/command-line-args';
import ValidCommandLineArgs from './interfaces/valid-command-line-args';
import UsernamePasswordCredentials from './interfaces/username-password-credentials';
import ValidUsernamePasswordCredentials from './interfaces/valid-username-password-credentials';
import { MessageEvent } from './interfaces/progress-event-emitter';
import Maybe from './interfaces/maybe';
import ExtractionTaskOptions from './interfaces/extractor-task-options';

import CredentialsPrompter from './credentials-prompter';
import ProgressBar from './progress-bar';
import ExtractionTask from './extraction-task';

export default class CommandLineInterface {
    protected progressBar: Maybe<ProgressBar> =
        Maybe.none<ProgressBar>();
    protected extractionTask: Maybe<ExtractionTask> =
        Maybe.none<ExtractionTask>();

    protected static readonly END_SIGNALS: NodeJS.Signals[] = [
        'SIGINT',
        'SIGTERM',
        'SIGHUP'
    ]

    protected static async getCommandLineArgs() {
        const cmdLineArgs = <CommandLineArgs> minimist(process.argv.slice(2), {
            string: [
                'username',
                'password',
                'fileName',
                'chromePath',
            ],

            default: {
                username: null,
                password: null,
                fileName: null,
                maxLimit: Number.POSITIVE_INFINITY,
                chromePath: null
            }
        });

        const credentials = await this.ensureCredentials(cmdLineArgs);
        cmdLineArgs.username = credentials.username;
        cmdLineArgs.password = credentials.password;

        return CommandLineInterface.validateCmdLineArgs(cmdLineArgs);
    }

    protected static async ensureCredentials(cmdLineArgs: CommandLineArgs) {
        const incomingCredentials: UsernamePasswordCredentials = {
            username: cmdLineArgs.username,
            password: cmdLineArgs.password
        };

        const noUsername = !incomingCredentials.username;
        const noPassword = !incomingCredentials.password;
        const atLeastOneCredentialMissing = noUsername || noPassword;

        if(atLeastOneCredentialMissing) {
            const credentialsPrompter = new CredentialsPrompter();
            return credentialsPrompter.prompt(incomingCredentials);
        }

        const credentials: ValidUsernamePasswordCredentials = {
            username: incomingCredentials.username,
            password: incomingCredentials.password
        };

        return credentials;
    }

    protected static validateCmdLineArgs(cmdLineArgs: CommandLineArgs) {
        this.validateMaxLimit(cmdLineArgs);

        // TODO verify if chromePath was provided, check if it exists at provided path
        return <ValidCommandLineArgs> cmdLineArgs;
    }

    protected static validateMaxLimit(cmdLineArgs: CommandLineArgs) {
        const {
            maxLimit,
        } = cmdLineArgs;
        if(typeof maxLimit === 'string') {
            const notValidLimitErr = new Error('Invalid max limit. Must be an integer.');
            throw notValidLimitErr;
        }

        if(!Number.isInteger(maxLimit) && maxLimit !== Number.POSITIVE_INFINITY) {
            const notValidLimitErr = new Error('Invalid max limit. Must be an integer.');
            throw notValidLimitErr;
        }
    }

    protected toExtractionTaskConfig(cmdLineArgs: ValidCommandLineArgs) {
        const {
            username,
            password,
            fileName,
            maxLimit,
            chromePath
        } = cmdLineArgs;

        const credentials: ValidUsernamePasswordCredentials = {
            username,
            password
        };

        const extractionTaskConfig: ExtractionTaskOptions = {
            credentials,
            fileName,
            maxLimit,
            chromePath,
            manualQuit: true,
            successCallback: this.stopAsComplete.bind(this),
            errorCallback: this.exitWithError.bind(this)
        };

        return extractionTaskConfig;
    }

    public async run() {
        this.watchForStopSignal();

        const cmdLineArgs =
            await this.tryGetCommandLineArgs();

        const extractionTaskConfig =
            this.toExtractionTaskConfig(cmdLineArgs);

        const extractionTask
            = new ExtractionTask(extractionTaskConfig);
        this.extractionTask = Maybe.some(extractionTask);

        const progressBar = new ProgressBar(extractionTask);
        this.progressBar = Maybe.some(progressBar);

        progressBar.startWatching();
        extractionTask.run();
    }

    protected async tryGetCommandLineArgs() {
        let cmdLineArgs: ValidCommandLineArgs;
        try {
            cmdLineArgs =
                await CommandLineInterface.getCommandLineArgs();
        } catch(err) {
            return this.exitWithError(err);
        }

        return cmdLineArgs;
    }

    protected exitWithSuccess() {
        return process.exit(0);
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
            .getOrElse((message: string) => console.error(message));

        exitMessage(err.message);
        return process.exit(1);
    }

    protected watchForStopSignal() {
        for(const signal of CommandLineInterface.END_SIGNALS)
            process.on(signal, this.stopAsIncomplete.bind(this));
    }

    protected stopWatchingForStopSignal() {
        for(const signal of CommandLineInterface.END_SIGNALS)
            process.off(signal, this.stopAsIncomplete.bind(this));
    }

    protected async stop(completed: boolean) {
        this.stopWatchingForStopSignal();

        this.progressBar
            .map(progressBar => progressBar.stopWatching());

        await this.extractionTask
            .mapAsync(task => task.stop(completed))

        this.exitWithSuccess();
    }

    protected async stopAsIncomplete() {
        return this.stop(false);
    }

    protected async stopAsComplete() {
        return this.stop(true);
    }
}
