import defaults from 'lodash.defaults';

import ExtractionTaskArgs, { EXTRACTION_TASK_ARGS_DEFAULTS } from '@args/extraction-task-args';
import ExtractionTaskArgsParser from './extraction-task-args-parser';

export default class ObjectExtractionTaskArgsParser implements ExtractionTaskArgsParser {
    constructor(
        private readonly args: Partial<ExtractionTaskArgs>
    ) {}

    public getExtractionTaskArgs() {
        return defaults(this.args, EXTRACTION_TASK_ARGS_DEFAULTS);
    }
}
