import { promisify } from 'util';
import {
    open as openFile,
    write as writeFile,
    close as closeFile
} from 'fs';

import Tweet from '../interfaces/tweet';
import Exporter from './exporter';

export default abstract class FileExporter extends Exporter {
    constructor(
        protected fileName: string
    ) {
        super();
    }

    protected abstract toText(tweets: Tweet[]): string;

    public async export(tweets: Tweet[]) {
        const tweetsAsText = this.toText(tweets);

        const openFileAsync = promisify(openFile);
        const tweetFileDesc = await openFileAsync(this.fileName, 'w');

        const writeFileAsync = promisify(writeFile);
        await writeFileAsync(tweetFileDesc, tweetsAsText);

        const closeFileAsync = promisify(closeFile);
        await closeFileAsync(tweetFileDesc);
    }
}
