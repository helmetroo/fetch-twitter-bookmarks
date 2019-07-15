import ExtractionTaskArgs from '@args/extraction-task-args';

import CommandLineExtractionTaskArgsParser from '@args-parsers/command-line-extraction-task-args-parser';
import ExtractionTaskArgsValidator from '@args-validators/extraction-task-args-validator';

import TestableArgsRetriever from './testable-args-retriever';

export default class TestableCommandLineArgsRetriever extends TestableArgsRetriever {
    constructor(
        private readonly args: string[]
    ) {}

    protected getExtractionTaskArgsParser() {
        return new CommandLineExtractionTaskArgsParser(this.args);
    }
}
