import TweetContainer from './tweet-container';

export default class TweetContainerList {
    protected list: TweetContainer[];
    protected tweetDate: Date = new Date();

    public get elements() {
        return this.list.map(container => container.element);
    }

    constructor(...list: TweetContainer[]) {
        this.list = list;
    }

    protected static subtractFromDate(date: Date) {
        const newDate = new Date(date);
        newDate.setDate(newDate.getDate() - 1);
        return date;
    }

    public push(container: TweetContainer) {
        this.tweetDate = TweetContainerList.subtractFromDate(this.tweetDate);
        const newId = new Date().getTime().toString();

        const storedContainer = container
            .withTweetId(newId)
            .withTweetDate(this.tweetDate);

        this.list.push(storedContainer);
    }
}
