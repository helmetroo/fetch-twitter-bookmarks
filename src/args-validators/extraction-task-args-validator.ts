import ExtractionTaskArgs, { ValidExtractionTaskArgs } from '@args/extraction-task-args';

export default class ExtractionTaskArgsValidator {
    public validate(args: ExtractionTaskArgs) {
        ExtractionTaskArgsValidator.validateMaxLimit(args);
        ExtractionTaskArgsValidator.validateSilence(args);

        return <ValidExtractionTaskArgs> {
            ...args
        };
    }

    protected static validateMaxLimit(args: ExtractionTaskArgs) {
        const maxLimit = args.maxLimit;

        if(typeof maxLimit === 'string') {
            const notValidLimitErr = new Error('Invalid max limit. Must be an integer.');
            throw notValidLimitErr;
        }

        if(!Number.isInteger(maxLimit) && maxLimit !== Number.POSITIVE_INFINITY) {
            const notValidLimitErr = new Error('Invalid max limit. Must be an integer.');
            throw notValidLimitErr;
        }
    }

    protected static validateSilence(args: ExtractionTaskArgs) {
        if(args.silent) {
            const fileName = args.fileName;
            if(!fileName) {
                const notValidLimitErr = new Error(`Must provide a filename if tweets won't be printed to STDOUT.`);
                throw notValidLimitErr;
            }
        }
    }
}
