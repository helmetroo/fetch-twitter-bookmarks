import { ParsedArgs } from 'minimist';

export default interface CommandLineArgs extends ParsedArgs {
    readonly username: string | null;
    readonly password: string | null;
    readonly fileName: string | null;
    readonly maxLimit: string | number;
    readonly chromePath: string | null;
}

export type OptionalCommandLineArgs = 'fileName' | 'chromePath';
export type RequiredCommandLineArgs = 'username' | 'password';
export type DefaultNumericCommandLineArgs = 'maxLimit';
