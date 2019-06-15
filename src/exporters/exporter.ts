import Tweet from '../interfaces/tweet';

export default abstract class Exporter {
    public abstract async export(tweets: Tweet[]): Promise<void>;
}
