interface ExtractionTaskArgs {
    fileName: string | null;
    maxLimit: string | number;
    silent: boolean;
}

type OptionalExtractionTaskArgs = 'fileName';
type DefaultNumericExtractionTaskArgs = 'maxLimit';
type DefaultBooleanExtractionTaskArgs = 'silent';
type Valid<T extends ExtractionTaskArgs> = {
    readonly [O in OptionalExtractionTaskArgs]: T[O] | null;
} & {
    readonly [DN in DefaultNumericExtractionTaskArgs]: Extract<T[DN], number>;
} & {
    readonly [DB in DefaultBooleanExtractionTaskArgs]: Extract<T[DB], boolean>;
}
type ValidExtractionTaskArgs = Valid<ExtractionTaskArgs>;

const EXTRACTION_TASK_ARGS_DEFAULTS: ExtractionTaskArgs = {
    fileName: null,
    maxLimit: Number.POSITIVE_INFINITY,
    silent: false,
};

export default ExtractionTaskArgs;
export {
    ValidExtractionTaskArgs,
    EXTRACTION_TASK_ARGS_DEFAULTS
};
