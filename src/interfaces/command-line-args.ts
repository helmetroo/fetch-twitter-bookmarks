import { ParsedArgs } from 'minimist';

export default interface CommandLineArgs extends ParsedArgs {
    username: string | null;
    password: string | null;
    readonly fileName: string | null;
    readonly maxLimit: string | number;
    readonly chromePath: string | null;
    readonly silent: boolean;
    readonly inspect: boolean;
}

// Ensured args are not required, but will make sure are defined later to continue operation
export type OptionalCommandLineArgs = 'fileName' | 'chromePath';
export type EnsuredCommandLineArgs = 'username' | 'password';
export type DefaultNumericCommandLineArgs = 'maxLimit';
export type DefaultBooleanCommandLineArgs = 'silent' | 'inspect';
