import { ParsedArgs } from 'minimist';

export default interface CommandLineArgs extends ParsedArgs {
    username: string | null;
    password: string | null;
    readonly fileName: string | null;
    readonly maxLimit: string | number;
    readonly chromePath: string | null;
}

export type OptionalCommandLineArgs = 'fileName' | 'chromePath';
export type RequiredCommandLineArgs = 'username' | 'password';
export type DefaultNumericCommandLineArgs = 'maxLimit';
