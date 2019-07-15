import { inject as Inject, injectable as Injectable } from 'inversify';

import AppInterface from '@app-interfaces/app-interface';

import IOC_TOKENS from '@ioc-tokens';
const {
    ExtractionTaskCreator: ExtractionTaskCreatorType
} = IOC_TOKENS;

@Injectable()
export default class TestableAppInterface extends AppInterface {
    constructor(
        @Inject(ExtractionTaskCreatorType)
        private readonly createExtractionTask: ExtractionTaskCreator
    ) {
        super();
    }

    public async run() {
        const extractionTask = await this.extractionTaskCreator.create();

        const errorCallback = this.throwError.bind(this);
        extractionTask.setErrorCallback(errorCallback);

        extractionTask.run();
    }

    protected throwError(err: Error) {
        throw err;
    }
}
