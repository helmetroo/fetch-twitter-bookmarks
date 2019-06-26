declare module 'password-prompt' {
    function prompt(ask: string, options?: {
        method: 'mask' | 'hide'
    }): Promise<string>;

    export = prompt;
}
