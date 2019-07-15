import ExtractionTaskArgs from '@args/extraction-task-args';

export default interface ExtractionTaskArgsParser {
    getExtractionTaskArgs(): ExtractionTaskArgs;
}
