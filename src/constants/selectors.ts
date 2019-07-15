const Selectors = {
    TweetArticle: 'article',
    Tweet: 'div[data-testid="tweet"]',
    TweetId: 'a:nth-child(3)',
    TweetTime: 'time',
    TweetProfile: 'a:first-child',
    TweetEmbeddedLink: 'div[data-testid="tweet"] a[target="_blank"]:last-child',
    TweetText: 'div[lang]',
    TweetTextBlocks: 'div[lang] > *',
    TweetImage: '[alt="Image"]',
    TweetVideo: 'video',
    TwitterButton: 'div[role="button"]',
};

export default Selectors;

type SelectorsObject = {
    [key in keyof typeof Selectors]: string
};
export { SelectorsObject };
