import Vorpal from 'vorpal';

import fetchAvailableBrowsers from '../utils/fetch-available-browsers';

import Client from '../client/client';
import type { ClientEvents, ClientEventKey } from '../client/client';
import type Credentials from '../client/credentials';

export default class CommandLineInterface {
    protected app: Vorpal;
    protected client: Client;

    protected setBrowserCommand?: Vorpal.Command;
    protected loginCommand?: Vorpal.Command;
    protected endCommand?: Vorpal.Command;

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

    start() {
        this.assertIsTTY();
        this.enableSetBrowserCommand();

        this.app
            .delimiter('fetch-twitter-bookmarks >')
            .show();
    }

    subscribeToClientEvents(events: Partial<ClientEvents>) {
        const eventNames = <ClientEventKey[]> Object.keys(events);
        for(const eventName of eventNames) {
            const handler = events[eventName]!;
            this.client.once(eventName, handler);
            this.client.prependOnceListener(eventName, () => {
                this.unsubscribeFromClientEvents(eventNames);
            });
        }
    }

    protected unsubscribeFromClientEvents(eventNames: ClientEventKey[]) {
        for(const eventName of eventNames)
            this.client.removeAllListeners(eventName);
    }

    logMessage(commandSource: Vorpal.CommandInstance) {
        return commandSource.log.bind(commandSource);
    }

    protected async enableSetBrowserCommand() {
        const availableBrowsers = await fetchAvailableBrowsers();
        const browserNames = availableBrowsers.map(browser => browser.name);
        const command = 'browser <name>';
        const commandDesc = [
            `Sets the browser used to login on your behalf to your Twitter account.`,
            `Available choices: ${browserNames.join(', ')}.`
        ].join('\r\n');

        this.setBrowserCommand = this.app
            .command(command, commandDesc)
            .autocomplete(browserNames)
            .action(this.onRequestSetBrowser(this));
    }

    protected disableSetBrowserCommand() {
        this.setBrowserCommand?.remove();
    }

    protected onRequestSetBrowser(cli: CommandLineInterface) {
        return async function(this: Vorpal.CommandInstance, args: Vorpal.Args) {
            const browserName = <string> args.name;

            const events: Partial<ClientEvents> = {
                success: () => {
                    cli.enableLoginCommand();
                    cli.enableEndCommand();
                    cli.logMessage(this)(`Browser set to ${browserName}. You may now login.`);
                },
                internalError: cli.logMessage(this),
                userError: cli.logMessage(this)
            };

            cli.subscribeToClientEvents(events);
            await cli.initClientBrowser(browserName);
        }
    }

    async initClientBrowser(browserName: string) {
        return this.client.init(browserName);
    }

    protected async enableLoginCommand() {
        this.disableSetBrowserCommand();

        this.loginCommand = this.app
            .command('login', 'Login to your Twitter account.')
            .alias('authenticate')
            .action(this.onRequestLogin(this));
    }

    protected disableLoginCommand() {
        this.loginCommand?.remove();
    }

    protected onRequestLogin(cli: CommandLineInterface) {
        return async function(this: Vorpal.CommandInstance, args: Vorpal.Args) {
            const events: Partial<ClientEvents> = {
                success: () => {
                    cli.disableLoginCommand();
                    cli.logMessage(this)('Successfully logged in!');
                },
                internalError: cli.logMessage(this),
                userError: cli.logMessage(this)
            };

            const credentials = <Credentials> await this.prompt([{
                name: 'username',
                message: 'Username or email: ',
                type: 'input'
            }, {
                name: 'password',
                message: 'Password: ',
                type: 'password'
            }]);

            cli.subscribeToClientEvents(events);
            await cli.logIn(credentials);
        }
    }

    async logIn(credentials: Credentials) {
        await this.client.logIn(credentials);
    }

    protected enableEndCommand() {
        this.endCommand = this.app
            .command('end', 'Closes the browser.')
            .alias('close')
            .action(this.onRequestEnd(this));
    }

    protected disableEndCommand() {
        this.endCommand?.remove();
    }

    protected onRequestEnd(cli: CommandLineInterface) {
        return async function(this: Vorpal.CommandInstance, args: Vorpal.Args) {
            const events: Partial<ClientEvents> = {
                success: () => {
                    cli.disableLoginCommand();
                    cli.disableEndCommand();
                    cli.enableSetBrowserCommand();
                    cli.logMessage(this)('Browser closed. If you were logged in, you were also logged out.');
                },
                internalError: cli.logMessage(this),
                userError: cli.logMessage(this)
            };

            cli.subscribeToClientEvents(events);
            await cli.end();
        }
    }

    async end() {
        await this.client.tearDown();
    }
}
