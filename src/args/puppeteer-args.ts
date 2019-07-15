interface PuppeteerArgs {
    username: string | null;
    password: string | null;
    inspect: boolean;
    chromePath: string | null;
}

// Ensured args are not required, but will be prompted for if not defined in order to continue
type EnsuredPuppeteerArgs = 'username' | 'password';
type OptionalPuppeteerArgs = 'chromePath';
type DefaultBooleanPuppeteerArgs = 'inspect';

type Valid<T extends PuppeteerArgs> = {
    readonly [O in OptionalPuppeteerArgs]: T[O] | null;
} & {
    readonly [DB in DefaultBooleanPuppeteerArgs]: Extract<T[DB], boolean>;
} & {
    readonly [E in EnsuredPuppeteerArgs]: NonNullable<T[E]>;
}
type ValidPuppeteerArgs = Valid<PuppeteerArgs>;

const PUPPETEER_ARGS_DEFAULTS: PuppeteerArgs = {
    username: null,
    password: null,
    chromePath: null,
    inspect: false
};

export default PuppeteerArgs;
export {
    ValidPuppeteerArgs,
    PUPPETEER_ARGS_DEFAULTS
};
