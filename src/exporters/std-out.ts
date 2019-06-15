import Tweet from '../interfaces/tweet';

import FileExporter from './file';
import Exporter from './exporter';

export default class StdOutExporter extends Exporter {
    public async export(tweets: Tweet[]) {
        const tweetsAsText = JSON.stringify(tweets) + '\n';
        process.stdout.write(tweetsAsText);
    }
}
