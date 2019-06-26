import CommandLineArgs, {
    OptionalCommandLineArgs,
    EnsuredCommandLineArgs,
    DefaultNumericCommandLineArgs,,
    DefaultBooleanCommandLineArgs
} from './command-line-args';

type Valid<T extends CommandLineArgs> = {
    readonly [O in OptionalCommandLineArgs]: T[O] | null;
} & {
    readonly [R in EnsuredCommandLineArgs]: NonNullable<T[R]>;
} & {
    readonly [D in DefaultNumericCommandLineArgs]: Extract<T[D], number>;
} & {
    readonly [D in DefaultBooleanCommandLineArgs]: Extract<T[D], boolean>;
}

type ValidCommandLineArgs = Valid<CommandLineArgs>;
export default ValidCommandLineArgs;
