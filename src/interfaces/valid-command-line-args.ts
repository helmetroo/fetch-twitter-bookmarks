import CommandLineArgs, {
    OptionalCommandLineArgs,
    RequiredCommandLineArgs,
    DefaultNumericCommandLineArgs
} from './command-line-args';

type Valid<T extends CommandLineArgs> = {
    readonly [O in OptionalCommandLineArgs]: T[O] | null;
} & {
    readonly [R in RequiredCommandLineArgs]: NonNullable<T[R]>;
} & {
    readonly [D in DefaultNumericCommandLineArgs]: Extract<T[D], number>;
}

type ValidCommandLineArgs = Valid<CommandLineArgs>;
export default ValidCommandLineArgs;
