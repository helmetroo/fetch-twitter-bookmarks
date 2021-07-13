import Vorpal from 'vorpal';

import Client, { State } from '../client/client';
import type { ErrorType as ClientErrorType, BrowserName } from '../client/client';
import Credentials, { AuthorizationCode } from '../client/credentials';
import { LoginErrorType, TwitterLoginError } from '../constants/error';

abstract class Command {
    protected abstract readonly identifier: string;
    protected abstract readonly description: string;
    protected readonly action: Vorpal.Action = this.createActionHandler(this.cli);
    protected readonly aliases?: string[];
    protected readonly autocomplete?: string[];
    protected ref?: Vorpal.Command;

    constructor(protected readonly cli: CommandLineFrontend) {}

    attach(app: Vorpal) {
        const ref = app.command(this.identifier, this.description)
            .action(this.action);

        if(this.autocomplete)
            ref.autocomplete(this.autocomplete);

        if(this.aliases)
            this.aliases.forEach(alias => ref.alias(alias));

        this.ref = ref;
    }

    detach() {
        this.ref?.remove();
    }

    protected abstract createActionHandler(cli: CommandLineFrontend): Vorpal.Action;
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
    protected readonly identifier: string = 'dump <file>';
    protected readonly description: string = 'Dump saved bookmarks to a JSON file.';

    protected createActionHandler(cli: CommandLineFrontend): Vorpal.Action {
        return async function(this: Vorpal.CommandInstance, args: Vorpal.Args) {
            const filePath = <string> args.file;
            await cli.dumpBookmarks(filePath);
        }
    }
}

type StateCommands = {
    [key in State]: Command[];
};

export default class CommandLineFrontend {
    protected app: Vorpal;
    protected client: Client;

    protected globalCommands: Command[] = [];

    protected stateCommands: StateCommands = {
        'NotReady': [],
        'LoggedOut': [],
        'LoggedIn': [],
        'FetchingBookmarks': []
    };

    constructor() {
        this.app = new Vorpal();
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

        this.app = this.app
            .delimiter('fetch-twitter-bookmarks >')
            .show();

        this.subscribeToClientEvents();
        await this.initClientDb();
        await this.initCommands();
    }

    protected async initClientDb() {
        await this.client.initDb();
    }

    protected async initCommands() {
        this.globalCommands = [
            // new QueryBookmarksCommand(this),
            new DumpBookmarksCommand(this),
        ];
        this.globalCommands.forEach(command => command.attach(this.app));

        const browserNames = await this.client.determineAvailableBrowsers();
        this.stateCommands[State.NotReady] = [
            new SetBrowserCommand(this, browserNames)
        ];
        this.stateCommands[State.NotReady]
            .forEach(command => command.attach(this.app));

        this.stateCommands[State.LoggedOut] = [
            new LoginCommand(this),
            new EndCommand(this),
        ];

        this.stateCommands[State.LoggedIn] = [
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
        newCommands.forEach(command => command.attach(this.app));
    }

    protected onClientError(type: ClientErrorType, message: string) {
        this.app.log(message);
    }

    protected onClientNotice(message: string) {
        this.app.log(message);
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
        await this.client.end();
    }
}
