import ExtractionTaskArgs from '@args/extraction-task-args';

import ArgsRetriever from './args-retriever';
import ObjectExtractionTaskArgsParser from '@args-parsers/object-extraction-task-args-parser';

export default class TestableObjectArgsRetriever extends ArgsRetriever {
    constructor(
        private readonly args: Partial<ExtractionTaskArgs>
    ) {}

    protected getExtractionTaskArgsParser() {
        return new ObjectExtractionTaskArgsParser(this.args);
    }
}
