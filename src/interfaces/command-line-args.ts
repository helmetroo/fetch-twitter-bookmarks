import { ParsedArgs } from 'minimist';

export default interface CommandLineArgs extends ParsedArgs
{
    username: string | null;
    password: string | null;
    fileName: string | null;
    maxLimit: number;
    useChromeExecutable: string | null;
}
