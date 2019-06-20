import minimist from 'minimist';

import CommandLineArgs from './interfaces/command-line-args';
import ValidCommandLineArgs from './interfaces/valid-command-line-args';
import UsernamePasswordCredentials from './interfaces/username-password-credentials';
import { MessageEvent } from './interfaces/progress-event-emitter';
import Maybe from './interfaces/maybe';
import ExtractionTaskOptions from './interfaces/extractor-task-options';

import ProgressBar from './progress-bar';
import ExtractionTask from './extraction-task';

export default class CommandLineInterface {
    protected progressBar: Maybe<ProgressBar> =
        Maybe.none<ProgressBar>();
    protected extractionTask: Maybe<ExtractionTask> =
        Maybe.none<ExtractionTask>();

    protected static readonly END_SIGNALS: NodeJS.Signals[] = [
        'SIGINT',
        'SIGTERM'
    ]

    protected static getCommandLineArgs() {
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

        return CommandLineInterface.validateCmdLineArgs(cmdLineArgs);
    }

    protected static validateCmdLineArgs(cmdLineArgs: CommandLineArgs) {
        const {
            username,
            password,
            maxLimit,
        } = cmdLineArgs;

        if(!username || !password) {
            const noCredentialsErr = new Error('No credentials provided.');
            throw noCredentialsErr;
        }

        if(typeof maxLimit === 'string') {
            const notValidLimitErr = new Error('Invalid max limit. Must be an integer.');
            throw notValidLimitErr;
        }

        if(!Number.isInteger(maxLimit) && maxLimit !== Number.POSITIVE_INFINITY) {
            const notValidLimitErr = new Error('Invalid max limit. Must be an integer.');
            throw notValidLimitErr;
        }

        // TODO verify if chromePath was provided, check if it exists at provided path
        return <ValidCommandLineArgs> cmdLineArgs;
    }

    protected toExtractionTaskConfig(cmdLineArgs: ValidCommandLineArgs) {
        const {
            username,
            password,
            fileName,
            maxLimit,
            chromePath
        } = cmdLineArgs; 

        const credentials: UsernamePasswordCredentials = {
            username,
            password
        };

        const extractionTaskConfig: ExtractionTaskOptions = {
            credentials,
            fileName,
            maxLimit,
            chromePath,
            successCallback: this.stop.bind(this),
            errorCallback: this.exitWithError.bind(this)
        };

        return extractionTaskConfig;
    }

    public async run() {
        this.watchForStopSignal();

        const cmdLineArgs =
            this.tryGetCommandLineArgs();

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

    protected tryGetCommandLineArgs() {
        let cmdLineArgs: ValidCommandLineArgs;
        try {
            cmdLineArgs =
                CommandLineInterface.getCommandLineArgs();
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
            process.on(signal, this.stop.bind(this));
    }

    protected stopWatchingForStopSignal() {
        for(const signal of CommandLineInterface.END_SIGNALS)
            process.off(signal, this.stop.bind(this));
    }

    protected stop() {
        this.stopWatchingForStopSignal();

        this.progressBar
            .map(progressBar => progressBar.stopWatching());

        this.exitWithSuccess();
    }
}
