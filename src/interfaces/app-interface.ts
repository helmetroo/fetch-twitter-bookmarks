import minimist from 'minimist';
import { injectable as Injectable } from 'inversify';

import CommandLineArgs from './command-line-args';
import ValidCommandLineArgs from './valid-command-line-args';
import UsernamePasswordCredentials from './username-password-credentials';
import ValidUsernamePasswordCredentials from './valid-username-password-credentials';
import ExtractionTaskOptions from './extractor-task-options';
import Maybe from './maybe';

import ExtractionTask from '../extraction-task';

@Injectable()
export default abstract class AppInterface {
    protected extractionTask: Maybe<ExtractionTask> =
        Maybe.none<ExtractionTask>();

    protected async runExtractionTask(stringArgs: string[]) {
        const extractedArgs =
            await this.tryExtractCommandLineArgs(stringArgs);

        const extractionTaskConfig =
            this.toExtractionTaskConfig(extractedArgs);

        const extractionTask
            = new ExtractionTask(extractionTaskConfig);
        this.extractionTask = Maybe.some(extractionTask);

        this.startExtractionTaskHooks();

        extractionTask.run();
    }

    protected async tryExtractCommandLineArgs(stringArgs: string[]) {
        let extractedArgs: ValidCommandLineArgs;
        try {
            extractedArgs =
                await this.extractCommandLineArgs(stringArgs);
        } catch(err) {
            return this.handleError(err);
        }

        return extractedArgs;
    }

    protected async extractCommandLineArgs(stringArgs: string[]) {
        const extractedArgs = <CommandLineArgs> minimist(stringArgs, {
            string: [
                'username',
                'password',
                'fileName',
                'chromePath',
            ],

            boolean: [
                'silent',
                'inspect',
            ],

            default: {
                username: null,
                password: null,
                fileName: null,
                maxLimit: Number.POSITIVE_INFINITY,
                chromePath: null,
                silent: false,
                inspect: false,
            }
        });

        return this.validateCmdLineArgs(extractedArgs);
    }

    protected async validateCmdLineArgs(cmdLineArgs: CommandLineArgs) {
        AppInterface.validateMaxLimit(cmdLineArgs);
        AppInterface.validateSilence(cmdLineArgs);

        const missingCmdLineArgs =
            await this.ensureDefinedCredentials(cmdLineArgs);

        // TODO verify if chromePath was provided, check if it exists at provided path
        const validArgs = <ValidCommandLineArgs> Object.assign(cmdLineArgs, missingCmdLineArgs);
        return validArgs;
    }

    protected static validateMaxLimit(cmdLineArgs: CommandLineArgs) {
        const maxLimit = cmdLineArgs.maxLimit;

        if(typeof maxLimit === 'string') {
            const notValidLimitErr = new Error('Invalid max limit. Must be an integer.');
            throw notValidLimitErr;
        }

        if(!Number.isInteger(maxLimit) && maxLimit !== Number.POSITIVE_INFINITY) {
            const notValidLimitErr = new Error('Invalid max limit. Must be an integer.');
            throw notValidLimitErr;
        }
    }

    protected static validateSilence(cmdLineArgs: CommandLineArgs) {
        if(cmdLineArgs.silent) {
            const fileName = cmdLineArgs.fileName;
            if(!fileName) {
                const notValidLimitErr = new Error(`Must provide a filename if tweets won't be printed to STDOUT.`);
                throw notValidLimitErr;
            }
        }
    }

    protected async ensureDefinedCredentials(cmdLineArgs: CommandLineArgs) {
        const incomingCredentials: UsernamePasswordCredentials = {
            username: cmdLineArgs.username,
            password: cmdLineArgs.password
        };

        if(incomingCredentials.username
           && incomingCredentials.password) {
            const credentials: ValidUsernamePasswordCredentials = {
                username: incomingCredentials.username,
                password: incomingCredentials.password
            };

            return credentials;
        }

        return this.requestCredentials(cmdLineArgs);
    }

    protected toExtractionTaskConfig(cmdLineArgs: ValidCommandLineArgs) {
        const {
            username,
            password,
            fileName,
            maxLimit,
            chromePath,
            silent,
            inspect,
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
            silent,
            inspect,
            manualQuit: true,
            successCallback: this.onTaskComplete.bind(this),
            errorCallback: this.handleError.bind(this)
        };

        return extractionTaskConfig;
    }

    protected startExtractionTaskHooks(): void {}
    protected stopExtractionTaskHooks(): void {}

    public abstract async run(stringArgs?: string[]): Promise<void>;
    protected abstract onTaskComplete(): void;
    protected abstract handleSuccess(): never | void;
    protected abstract handleError(err: Error): never;
    protected abstract async requestCredentials(cmdLineArgs: CommandLineArgs): Promise<ValidUsernamePasswordCredentials>;
}
