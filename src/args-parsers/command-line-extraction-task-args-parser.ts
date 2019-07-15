import { Opts } from 'minimist';

import ExtractionTaskArgs, { EXTRACTION_TASK_ARGS_DEFAULTS } from '@args/extraction-task-args';

import CommandLineArgsParser from './command-line-args-parser';
import ExtractionTaskArgsParser from './extraction-task-args-parser';

export default class CommandLineExtractionTaskArgsParser
extends CommandLineArgsParser
implements ExtractionTaskArgsParser {
    private static readonly MINIMIST_OPTS: Opts = {
        string: [
            'fileName',
        ],

        boolean: [
            'silent',
        ],

        default: EXTRACTION_TASK_ARGS_DEFAULTS
    };

    constructor(
        private readonly args: string[]
    ) {
        super();
    }

    public getExtractionTaskArgs() {
        return this.parse(
            this.args, CommandLineExtractionTaskArgsParser.MINIMIST_OPTS
        ) as unknown as ExtractionTaskArgs;
    }
}
