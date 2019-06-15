import Tweet from '../interfaces/tweet';

import FileExporter from './file';

export default class JsonExporter extends FileExporter {
    constructor(
        protected fileName: string
    ) {
        super(fileName);
    }

    protected toText(tweets: Tweet[]) {
        return JSON.stringify(tweets);
    }
}
