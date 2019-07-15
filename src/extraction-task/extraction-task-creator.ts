import { injectable as Injectable } from 'inversify';

import ExtractionTask from './extraction-task';

@Injectable()
export default abstract class ExtractionTaskCreator {
    public abstract async create(): Promise<ExtractionTask>;
}
