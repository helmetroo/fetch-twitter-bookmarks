export default interface Tweet {
    id: string,
    profile: string,
    text: string,
    date: string,
    links: TweetLinks,
    media: TweetMedia
}

export interface TweetLinks {
    toProfile: string,
    toTweet: string,
    embedded: string | null
}

export interface TweetMedia {
    images: string[],
    video: string | null
}
