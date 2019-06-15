import { Map, hash } from 'immutable';

type TweetLinksMap = Map<string, string>;
type TweetMediaMap = Map<string, string | string[]>;
type TweetMap = Map<string, string | TweetLinksMap | TweetMediaMap>;

export default TweetMap;
export const TweetMapHashCode = function(this: TweetMap) {
    const tweetLink = <string> this.get('id');
    return hash(tweetLink);
}

export const TweetMapEquals = function(this: TweetMap, other: any) {
    if(!(other instanceof Map))
        return false;

    const otherMap = <TweetMap> other;
    const thisId = <string> this.get('id');
    const otherId = <string> otherMap.get('id');

    return thisId === otherId;
}
