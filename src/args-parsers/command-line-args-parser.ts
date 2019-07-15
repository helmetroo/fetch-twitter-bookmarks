import minimist, { Opts } from 'minimist';

export default abstract class CommandLineArgsParser {
    protected parse(argsList: string[], minimistOpts: Opts) {
        return minimist(argsList, minimistOpts);
    }
}
