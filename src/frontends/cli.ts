import Vorpal from 'vorpal';

import Client, { State } from '../client/client';
import type { BrowserName } from '../client/client';
import type Credentials from '../client/credentials';

abstract class Command {
    protected abstract readonly identifier: string;
    protected abstract readonly description: string;
    protected abstract readonly action: Vorpal.Action;
    protected readonly autocomplete?: string[];
    protected ref?: Vorpal.Command;

    attach(app: Vorpal) {
        this.ref = app.command(this.identifier, this.description)
            .action(this.action);

        if(this.autocomplete)
            this.ref.autocomplete(this.autocomplete);
    }

    detach() {
        this.ref?.remove();
    }

    protected abstract createActionHandler(cli: CommandLineFrontend): Vorpal.Action;
}

class SetBrowserCommand extends Command {
    protected readonly identifier: string = 'browser <name>';
    protected readonly description: string;
    protected readonly action: Vorpal.Action;
    protected readonly autocomplete: string[];

    constructor(
        readonly cli: CommandLineFrontend,
        readonly browserNames: string[]
    ) {
        super();

        this.description = [
            `Sets the browser used to login on your behalf to your Twitter account.`,
            `Available choices: ${browserNames.join(', ')}.`
        ].join('\r\n');

        this.autocomplete = browserNames;

        this.action = this.createActionHandler(cli);
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
    protected readonly action: Vorpal.Action;

    constructor(readonly cli: CommandLineFrontend) {
        super();

        this.action = this.createActionHandler(cli);
    }

    protected createActionHandler(cli: CommandLineFrontend) {
        return async function(this: Vorpal.CommandInstance) {
            const credentials = <Credentials> await this.prompt([{
                name: 'username',
                message: 'Username or email: ',
                type: 'input'
            }, {
                name: 'password',
                message: 'Password: ',
                type: 'password'
            }]);

            await cli.logIn(credentials);
        };
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
            // new QueryBookmarksCommand(),
            // new DumpBookmarksCommand(),
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
        ];

        this.stateCommands[State.LoggedIn] = [
            // new FetchBookmarksCommand(),
        ];

        this.stateCommands[State.FetchingBookmarks] = [
            // new StopFetchBookmarksCommand(),
        ];
    }

    protected subscribeToClientEvents() {
        this.client.on('transition', this.onClientTransition.bind(this));
        this.client.on('notice', this.onClientNotice.bind(this));
    }

    protected onClientTransition(oldState: State, newState: State) {
        const oldCommands = this.stateCommands[oldState];
        oldCommands.forEach(command => command.detach());

        const newCommands = this.stateCommands[newState];
        newCommands.forEach(command => command.attach(this.app));
    }

    protected onClientNotice(message: string) {
        //return commandSource.log.bind(commandSource);
        this.app.log(message);
    }

//     subscribeToClientEvents(events: Partial<ClientEvents>) {
//         const eventNames = <ClientEventKey[]> Object.keys(events);
//         for(const eventName of eventNames) {
//             const handler = events[eventName]!;
//             this.client.once(eventName, handler);
//             this.client.prependOnceListener(eventName, () => {
//                 this.unsubscribeFromClientEvents(eventNames);
//             });
//         }
//     }

//     protected unsubscribeFromClientEvents(eventNames: ClientEventKey[]) {
//         for(const eventName of eventNames)
//             this.client.removeAllListeners(eventName);
//     }

//     protected async enableSetBrowserCommand() {
//         const command = 'browser <name>';
//         const commandDesc = [
//             `Sets the browser used to login on your behalf to your Twitter account.`,
//             `Available choices: ${browserNames.join(', ')}.`
//         ].join('\r\n');

//         this.setBrowserCommand = this.app
//             .command(command, commandDesc)
//             .autocomplete(browserNames)
//             .action(this.onRequestSetBrowser(this));
//     }

//     protected disableSetBrowserCommand() {
//         this.setBrowserCommand?.remove();
//     }

//     protected onRequestSetBrowser(cli: CommandLineFrontend) {
//         return async function(this: Vorpal.CommandInstance, args: Vorpal.Args) {
//             const browserName = <string> args.name;

//             const events: Partial<ClientEvents> = {
//                 success: () => {
//                     cli.enableLoginCommand();
//                     cli.enableEndCommand();
//                     cli.logMessage(this)(`Browser set to ${browserName}. You may now login.`);
//                 },
//                 internalError: cli.logMessage(this),
//                 userError: cli.logMessage(this)
//             };

//             cli.subscribeToClientEvents(events);
//             await cli.initClientBrowser(browserName);
//         }
//     }

    async initClientBrowser(browserName: BrowserName) {
        return this.client.initBrowser(browserName);
    }

//     protected async enableLoginCommand() {
//         this.disableSetBrowserCommand();

//         this.loginCommand = this.app
//             .command('login', 'Login to your Twitter account.')
//             .alias('authenticate')
//             .action(this.onRequestLogin(this));
//     }

//     protected disableLoginCommand() {
//         this.loginCommand?.remove();
//     }

//     protected onRequestLogin(cli: CommandLineFrontend) {
//         return async function(this: Vorpal.CommandInstance) {
//             const events: Partial<ClientEvents> = {
//                 success: () => {
//                     cli.disableLoginCommand();
//                     cli.enableFetchBookmarksCommand();
//                     cli.logMessage(this)('Successfully logged in!');
//                 },
//                 internalError: cli.logMessage(this),
//                 userError: cli.logMessage(this)
//             };

//             const credentials = <Credentials> await this.prompt([{
//                 name: 'username',
//                 message: 'Username or email: ',
//                 type: 'input'
//             }, {
//                 name: 'password',
//                 message: 'Password: ',
//                 type: 'password'
//             }]);

//             cli.subscribeToClientEvents(events);
//             await cli.logIn(credentials);
//         }
//     }

    async logIn(credentials: Credentials) {
        await this.client.logIn(credentials);
    }

//     protected enableFetchBookmarksCommand() {
//         this.fetchBookmarksCommand = this.app
//             .command('fetch', 'Begins fetching bookmarks.')
//             .alias('start')
//             .action(this.onRequestFetchBookmarks(this));
//     }

//     protected disableFetchBookmarksCommand() {
//         this.fetchBookmarksCommand?.remove();
//     }

//     protected onRequestFetchBookmarks(cli: CommandLineFrontend) {
//         return async function(this: Vorpal.CommandInstance) {
//             const events: Partial<ClientEvents> = {
//                 success: () => {
//                     cli.disableFetchBookmarksCommand();
//                     cli.logMessage(this)('Initial bookmarks fetched');
//                 },
//                 internalError: cli.logMessage(this)
//             };

//             cli.subscribeToClientEvents(events);
//             await cli.startFetchingBookmarks();
//         }
//     }

//     async startFetchingBookmarks() {
//         await this.client.startFetchingBookmarks();
//     }

//     protected enableEndCommand() {
//         this.endCommand = this.app
//             .command('end', 'Closes the browser.')
//             .alias('close')
//             .action(this.onRequestEnd(this));
//     }

//     protected disableEndCommand() {
//         this.endCommand?.remove();
//     }

//     protected onRequestEnd(cli: CommandLineFrontend) {
//         return async function(this: Vorpal.CommandInstance) {
//             const events: Partial<ClientEvents> = {
//                 success: () => {
//                     cli.disableLoginCommand();
//                     cli.disableEndCommand();
//                     cli.enableSetBrowserCommand();
//                     cli.logMessage(this)('Browser closed. If you were logged in, you were also logged out.');
//                 },
//                 internalError: cli.logMessage(this),
//                 userError: cli.logMessage(this)
//             };

//             cli.subscribeToClientEvents(events);
//             await cli.end();
//         }
//     }

//     async end() {
//         await this.client.shutDown();
//     }
    //
}
