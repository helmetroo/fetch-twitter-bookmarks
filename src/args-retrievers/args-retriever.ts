import { ValidExtractionTaskArgs } from '@args/extraction-task-args';

import ExtractionTaskArgsParser from '@args-parsers/extraction-task-args-parser';

import ExtractionTaskArgsValidator from '@args-validators/extraction-task-args-validator';

export default abstract class ArgsRetriever {
    protected abstract getExtractionTaskArgsParser(): ExtractionTaskArgsParser;

    public getExtractionTaskArgs() {
        const argsParser = this.getExtractionTaskArgsParser();
        const extractionTaskArgs = argsParser.getExtractionTaskArgs();

        const argsValidator = new ExtractionTaskArgsValidator();
        argsValidator.validate(extractionTaskArgs);

        return <ValidExtractionTaskArgs> extractionTaskArgs;
    }
}
