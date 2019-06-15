import CommandLineArgs from './command-line-args';

export default interface ValidCommandLineArgs extends CommandLineArgs
{
    username: string;
    password: string;
    fileName: string | null;
    maxLimit: number;
    useChromeExecutable: string;
}
