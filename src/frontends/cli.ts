import Vorpal from 'vorpal';

import { Application } from '../constants/application';
import { LoginErrorType, TwitterLoginError } from '../constants/error';
import { BrowserName } from '../utils/fetch-available-browsers';

import Client, { State } from '../client/client';
import type { ErrorType as ClientErrorType } from '../client/client';
import Credentials, { AuthorizationCode } from '../client/credentials';

interface Argument {
    shortName?: string;
    longName: string;
    params?: string;
}

const inMemoryArg = {
    shortName: 'm',
    longName: 'in-memory'
} as const;
type InMemoryArg =
    typeof inMemoryArg['shortName']
    | typeof inMemoryArg['longName'];

const dbFileArg = {
    shortName: 'f',
    longName: 'db',
    params: '<filename>'
} as const;
type DbFileArg =
    typeof dbFileArg['shortName']
    | typeof dbFileArg['longName'];

const defaultDbArg = {
    shortName: 'd',
    longName: 'default'
} as const;
type DefaultDbArg =
    typeof defaultDbArg['shortName']
    | typeof defaultDbArg['longName'];

const logFileArg = {
    shortName: 'l',
    longName: 'log-file',
    params: '<filename>'
} as const;
type LogFileArg =
    typeof logFileArg['shortName']
    | typeof logFileArg['longName'];

const clearLogArg = {
    longName: 'clear-log',
} as const;
type ClearLogArg = typeof clearLogArg['longName'];

type CommandLineArgs = {
    [k in InMemoryArg]?: boolean;
} & {
    [k in DbFileArg]?: string;
} & {
    [k in DefaultDbArg]?: boolean;
} & {
    [k in LogFileArg]?: string;
} & {
    [k in ClearLogArg]?: string;
};

interface CommandOption {
    name: string;
    help: string;
    autocomplete?: string[];
}

abstract class Command {
    protected abstract readonly identifier: string;
    protected abstract readonly description: string;
    protected readonly action: Vorpal.Action = this.createActionHandler(this.cli);
    protected readonly aliases?: string[];
    protected readonly autocomplete?: string[];
    protected readonly options?: CommandOption[];
    protected ref?: Vorpal.Command;

    constructor(protected readonly cli: CommandLineFrontend) {}

    attach(app: Vorpal) {
        const ref = app.command(this.identifier, this.description)
            .action(this.action);

        if(this.autocomplete)
            ref.autocomplete(this.autocomplete);

        if(this.aliases)
            this.aliases.forEach(alias => ref.alias(alias));

        if(this.options) {
            this.options.forEach(option => {
                const {
                    name,
                    help,
                    autocomplete
                } = option;

                ref.option(name, help, autocomplete);
            });
        }

        this.ref = ref;
    }

    detach() {
        this.ref?.remove();
    }

    protected abstract createActionHandler(cli: CommandLineFrontend): Vorpal.Action;

    static toVorpalOptions(args: Argument) {
        const {
            shortName: shortName,
            longName: longName,
            params
        } = args;

        return params
            ? `-${shortName}, --${longName} ${params}`
            : `-${shortName}, --${longName}`;
    }
}

class SetBrowserCommand extends Command {
    protected readonly identifier: string = 'browser <name>';
    protected readonly description: string;
    protected readonly autocomplete: string[];
    protected readonly aliases: string[] = ['set-browser'];

    constructor(
        protected readonly cli: CommandLineFrontend,
        readonly browserNames: string[]
    ) {
        super(cli);

        this.description = [
            `Sets the browser used to login on your behalf to your Twitter account.`,
            `Available choices: ${browserNames.join(', ')}.`
        ].join('\r\n');

        this.autocomplete = browserNames;
    }

    protected createActionHandler(cli: CommandLineFrontend) {
        return async function(this: Vorpal.CommandInstance, args: Vorpal.Args) {
            const browserName = <BrowserName> args.name;
            await cli.initClientBrowser(browserName);
        };
    }
}

class SetDatabaseCommand extends Command {
    protected readonly identifier: string = 'set-database';
    protected readonly description: string = 'Sets the database fetched bookmarks are saved to.';
    protected readonly aliases: string[] = ['set-db', 'db'];
    protected readonly options: CommandOption[] = [{
        name: Command.toVorpalOptions(inMemoryArg),
        help: `Database is kept in memory. Ignored if --${dbFileArg.longName} is set. WARNING: All bookmarks will be lost when you exit.`
    }, {
        name: Command.toVorpalOptions(dbFileArg),
        help: `Saves bookmarks database to a file. Ignored if --${inMemoryArg.longName} is set.`
    }, {
        name: Command.toVorpalOptions(defaultDbArg),
        help: `Saves bookmarks database to the default location. Ignored if either --${dbFileArg.longName} or --${inMemoryArg.longName} are set.`
    }];

    protected createActionHandler(cli: CommandLineFrontend) {
        const self = this;
        return async function(this: Vorpal.CommandInstance, args: Vorpal.Args) {
            const opts = args.options;
            const noOptsProvided = SetDatabaseCommand.noOptsProvided(opts);
            if(noOptsProvided) {
                this.log(`Please provide at least one option. Run \`help ${self.identifier}\` for info on options.`);
                return;
            }

            await cli.setClientDbFromArgs(opts);
        };
    }

    protected static noOptsProvided(opts: CommandLineArgs) {
        const argsToCheck = [
            dbFileArg,
            inMemoryArg,
            defaultDbArg
        ];

        return argsToCheck.every(
            arg => !opts[arg.shortName] && !opts[arg.longName]
        );
    }
}

class SetLogCommand extends Command {
    protected readonly identifier: string = 'set-log <filename>';
    protected readonly description: string = 'Sets the location for log files.';

    protected createActionHandler(cli: CommandLineFrontend) {
        return async function(this: Vorpal.CommandInstance, args: Vorpal.Args) {
            const filename = <string> args.filename;
            cli.setClientLogFromFilename(filename);
        };
    }
}

class ClearLogCommand extends Command {
    protected readonly identifier: string = 'clear-log';
    protected readonly description: string = 'Clears log files.';

    protected createActionHandler(cli: CommandLineFrontend) {
        return async function(this: Vorpal.CommandInstance) {
            await cli.clearLog();
        };
    }
}

class LoginCommand extends Command {
    protected readonly identifier: string = 'login';
    protected readonly description: string = 'Login to your Twitter account.';
    protected readonly aliases: string[] = ['signin', 'authenticate'];

    protected promptForCredentials(
        cmd: Vorpal.CommandInstance,
        usernameMsg = 'Phone, username or email'
    ): Promise<Credentials> {
        return <Promise<Credentials>> cmd.prompt([{
            name: 'username',
            message: `${usernameMsg}: `,
            type: 'input'
        }, {
            name: 'password',
            message: 'Password: ',
            type: 'password'
        }]);
    }

    protected promptForAuthCode(cmd: Vorpal.CommandInstance): Promise<AuthorizationCode> {
        return <Promise<AuthorizationCode>> cmd.prompt([{
            name: 'authCode',
            message: 'Code: ',
            type: 'password'
        }]);
    }

    protected createActionHandler(cli: CommandLineFrontend) {
        const cliCmd = this;
        return async function(this: Vorpal.CommandInstance) {
            const credentials =
                await cliCmd.promptForCredentials(this);

            try {
                await cli.logIn(credentials);
            } catch(err) {
                if(err instanceof TwitterLoginError)
                    await cliCmd.blockUntilLoginErrorHandled.call(cliCmd, err, this, cli);
            }
        };
    }

    protected async blockUntilLoginErrorHandled(
        err: TwitterLoginError,
        cmd: Vorpal.CommandInstance,
        cli: CommandLineFrontend
    ) {
        let lastError = err;
        while(true) {
            cmd.log(lastError.message);

            try {
                await this.handleLastLoginError(lastError, cmd, cli);
                break;
            } catch(err) {
                if(err instanceof TwitterLoginError) {
                    lastError = err;
                    continue;
                }

                break;
            }
        }
    }

    protected async handleLastLoginError(
        lastError: TwitterLoginError,
        cmd: Vorpal.CommandInstance,
        cli: CommandLineFrontend
    ) {
        const reqsUsernameOrPhoneOnly =
            (lastError.type === LoginErrorType.RequiresUsernameOrPhoneOnly);
        if(reqsUsernameOrPhoneOnly)
            return this.tryWithUsernameOrPhoneOnly(cmd, cli);

        const reqsAuthCode =
            (lastError.type === LoginErrorType.RequiresAuthCode);
        if(reqsAuthCode)
            return this.tryWithAuthCode(cmd, cli);

        return this.tryWithCredentials(cmd, cli);
    }

    protected async tryWithCredentials(cmd: Vorpal.CommandInstance, cli: CommandLineFrontend) {
        const credentials = await this.promptForCredentials(cmd);
        await cli.logIn(credentials);
    }

    protected async tryWithUsernameOrPhoneOnly(cmd: Vorpal.CommandInstance, cli: CommandLineFrontend) {
        const phoneUsernameCreds =
            await this.promptForCredentials(cmd, 'Phone or username');
        await cli.logIn(phoneUsernameCreds);
    }

    protected async tryWithAuthCode(cmd: Vorpal.CommandInstance, cli: CommandLineFrontend) {
        const authCode = await this.promptForAuthCode(cmd);
        await cli.enterAuthorizationCode(authCode);
    }
}

class EndCommand extends Command {
    protected readonly identifier: string = 'end';
    protected readonly description: string = 'Ends your session. Bookmarks will stop being fetched, and you will also be logged out.';

    protected createActionHandler(cli: CommandLineFrontend): Vorpal.Action {
        return async function() {
            await cli.end();
        }
    }
}

class FetchBookmarksCommand extends Command {
    protected readonly identifier: string = 'fetch';
    protected readonly description: string = 'Starts fetching bookmarks.';

    protected createActionHandler(cli: CommandLineFrontend): Vorpal.Action {
        return async function() {
            await cli.startFetchingBookmarks();
        }
    }
}

class StopFetchBookmarksCommand extends Command {
    protected readonly identifier: string = 'stop';
    protected readonly description: string = 'Stops fetching bookmarks.';

    protected createActionHandler(cli: CommandLineFrontend): Vorpal.Action {
        return async function() {
            cli.stopFetchingBookmarks();
        }
    }
}

class DumpBookmarksCommand extends Command {
    protected readonly identifier: string = 'dump <filename>';
    protected readonly description: string = 'Dump saved bookmarks to a JSON file.';

    protected createActionHandler(cli: CommandLineFrontend): Vorpal.Action {
        return async function(this: Vorpal.CommandInstance, args: Vorpal.Args) {
            const filePath = <string> args.filename;
            await cli.dumpBookmarks(filePath);
        }
    }
}

type StateCommands = {
    [key in State]: Command[];
};

export default class CommandLineFrontend {
    protected shell: Vorpal;
    protected client: Client;

    protected globalCommands: Command[] = [];

    protected stateCommands: StateCommands = {
        'NotReady': [],
        'LoggedOut': [],
        'LoggedIn': [],
        'FetchingBookmarks': []
    };

    constructor() {
        this.shell = new Vorpal();
        this.client = new Client();
    }

    protected assertIsTTY() {
        const isTTY = process.stdin.isTTY;
        if(!isTTY) {
            process.stderr.write('This requires a TTY terminal to function properly. Apologies!');
            process.exit(1);
        }
    }

    async init() {
        this.assertIsTTY();
        this.show();
        this.subscribeToClientEvents();
        await this.processCliArgs();
        await this.initCommands();
    }

    protected show() {
        this.shell = this.shell
            .delimiter('fetch-twitter-bookmarks >')
            .show();
    }

    protected async processCliArgs() {
        const cliArgs =
            <CommandLineArgs> this.shell.parse(process.argv, {
                use: 'minimist'
            });

        await this.handleCliArgs(cliArgs);
    }

    protected async handleCliArgs(args: CommandLineArgs) {
        await this.setClientDbFromArgs(args);
        await this.setupLogFromArgs(args);
    }

    async setClientDbFromArgs(args: CommandLineArgs) {
        const config = Application.Defaults.DB_CONFIG;

        const useDefaultDb =
            (args[defaultDbArg.longName] || args[defaultDbArg.shortName])
            ?? false;
        if(useDefaultDb) {
            return this.client.setDb(config);
        }

        const inMemory =
            (args[inMemoryArg.longName] || args[inMemoryArg.shortName])
            ?? false;
        if(inMemory) {
            config.inMemory = inMemory;
            return this.client.setDb(config);
        }

        const filename =
            (args[dbFileArg.longName] || args[dbFileArg.shortName])
            ?? Application.Defaults.DATABASE_PATH;
        if(filename) {
            config.storagePath = filename;
            config.inMemory = false;
        }

        return this.client.setDb(config);
    }

    protected static extractLogFilenameFromArgs(args: CommandLineArgs) {
        return (args[logFileArg.longName] || args[logFileArg.shortName])
            ?? Application.Defaults.DEBUG_LOG_FILENAME;
    }

    protected async setupLogFromArgs(args: CommandLineArgs) {
        const logFilename = CommandLineFrontend.extractLogFilenameFromArgs(args);
        const clearLog = args[clearLogArg.longName] ?? false;

        if(clearLog)
            await this.clearLog(logFilename);

        this.setClientLogFromFilename(logFilename);
    }

    setClientLogFromArgs(args: CommandLineArgs) {
        const logFilename =
            (args[logFileArg.longName] || args[logFileArg.shortName])
            ?? Application.Defaults.DEBUG_LOG_FILENAME;

        this.setClientLogFromFilename(logFilename);
    }

    setClientLogFromFilename(filename: string) {
        this.client.setLogger(filename);
    }

    async clearLog(filename?: string) {
        await this.client.clearLog(filename);
    }

    protected async initCommands() {
        this.globalCommands = [
            // new QueryBookmarksCommand(this),
            new DumpBookmarksCommand(this),
            new SetLogCommand(this),
            new ClearLogCommand(this),
        ];
        this.globalCommands.forEach(command => command.attach(this.shell));

        const browserNames = await this.client.determineAvailableBrowsers();
        this.stateCommands[State.NotReady] = [
            new SetDatabaseCommand(this),
            new SetBrowserCommand(this, browserNames)
        ];
        this.stateCommands[State.NotReady]
            .forEach(command => command.attach(this.shell));

        this.stateCommands[State.LoggedOut] = [
            new SetDatabaseCommand(this),
            new LoginCommand(this),
            new EndCommand(this),
        ];

        this.stateCommands[State.LoggedIn] = [
            new SetDatabaseCommand(this),
            new FetchBookmarksCommand(this),
            new EndCommand(this),
        ];

        this.stateCommands[State.FetchingBookmarks] = [
            new StopFetchBookmarksCommand(this),
            new EndCommand(this),
        ];
    }

    protected subscribeToClientEvents() {
        this.client.on('transition', this.onClientTransition.bind(this));
        this.client.on('error', this.onClientError.bind(this));
        this.client.on('notice', this.onClientNotice.bind(this));
    }

    protected onClientTransition(oldState: State, newState: State) {
        const oldCommands = this.stateCommands[oldState];
        oldCommands.forEach(command => command.detach());

        const newCommands = this.stateCommands[newState];
        newCommands.forEach(command => command.attach(this.shell));
    }

    protected onClientError(type: ClientErrorType, message: string) {
        // TODO color errors
        this.shell.log(message);
    }

    protected onClientNotice(message: string) {
        this.shell.log(message);
    }

    async initClientBrowser(browserName: BrowserName) {
        return this.client.initBrowser(browserName);
    }

    async logIn(credentials: Credentials) {
        await this.client.logIn(credentials);
    }

    async enterAuthorizationCode(authCode: AuthorizationCode) {
        await this.client.enterAuthorizationCode(authCode);
    }

    async dumpBookmarks(filePath: string) {
        await this.client.dumpBookmarks(filePath);
    }

    async startFetchingBookmarks() {
        await this.client.startFetchingBookmarks();
    }

    stopFetchingBookmarks() {
        this.client.stopFetchingBookmarks();
    }

    async end() {
        // TODO may want to wait until any logs have been written
        await this.client.end();
    }
}
