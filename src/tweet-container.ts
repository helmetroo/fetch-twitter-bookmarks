import { Substitute, SubstituteOf, Arg } from '@fluffy-spoon/substitute';
import { Page, ElementHandle } from 'puppeteer';
import UrlRegex from 'url-regex';
import EmojiRegex from 'emoji-regex';

import Selectors, { SelectorsSubset } from './constants/selectors';
const {
    TweetArticle,
    Tweet,
    TweetId,
    TweetTime,
    TweetProfile,
    TweetEmbeddedLink,
    TweetText,
    TweetTextBlocks,
    TweetImage,
    TweetVideo
} = Selectors;

import extractText from './utils/extract-text';

const NULL = Promise.resolve(null);
const emojiRegex = EmojiRegex();
const urlRegex = UrlRegex({
    strict: true
});

export default class TweetContainer {
    protected parentContainerElem: SubstituteOf<ElementHandle<Element>>;
    protected containerElem: SubstituteOf<ElementHandle<Element>>;

    public get element() {
        return this.parentContainerElem;
    }

    constructor() {
        this.containerElem = Substitute.for<ElementHandle<Element>>();
        this.parentContainerElem = Substitute.for<ElementHandle<Element>>();
        this.parentContainerElem.$(Tweet)
            .returns(Promise.resolve(this.containerElem));
    }

    public withTweetId(id: string) {
        this.containerElem.$eval(TweetId, Arg.any())
            .returns(Promise.resolve(id));

        return this;
    }

    public withTweetDate(date: Date) {
        const dateString = date.toISOString();

        this.containerElem.$eval(TweetTime, Arg.any())
            .returns(Promise.resolve(dateString));

        return this;
    }

    public withTweetProfile(profile: string) {
        this.containerElem.$eval(TweetProfile, Arg.any())
            .returns(Promise.resolve(profile));

        return this;
    }

    public withTweetText(text: string) {
        const textBlocks = TweetContainer.toTextBlocks(text);

        const tweetTextContainer = Substitute.for<ElementHandle<Element>>();
        tweetTextContainer.$$eval(TweetTextBlocks, Arg.any())
            .returns(Promise.resolve(textBlocks));

        this.containerElem.$(TweetText)
            .returns(Promise.resolve(tweetTextContainer));

        return this;
    }

    protected static toTextBlocks(text: string) {
        const splitText = text.split(urlRegex);
        const textBlocks: string[] = [];
        for(const block of splitText) {
            if(block)
                textBlocks.push(block);

            const urlMatch = urlRegex.exec(text);
            if(urlMatch) {
                const url = urlMatch[0];
                const urlText = (url.length > 37)
                    ? `${url.substr(0, 37)}…`
                    : url;
                const urlString = `(link: ${url}) ${urlText}`;
                textBlocks.push(urlString);
            }
        }
    }

    public withEmbeddedLink(link: string) {
        this.containerElem.$eval(TweetEmbeddedLink, Arg.any())
            .returns(Promise.resolve(link));

        return this;
    }

    protected static toTextElementBlocks(text: string) {
        const textBlocks: SubstituteOf<HTMLElement>[] = [];
        const splitText = text.split(emojiRegex);
        for(const word of splitText) {
            if(word) {
                const textBlock = TweetContainer.createTextBlock(word);
                textBlocks.push(textBlock);
            }

            const emojiMatch = emojiRegex.exec(text);
            if(emojiMatch) {
                const emoji = emojiMatch[0];
                const emojiBlock = TweetContainer.createEmojiTextBlock(emoji);
                textBlocks.push(emojiBlock);
            }
        }

        return textBlocks;
    }

    protected static createEmptyTextBlock() {
        const textBlock = Substitute.for<HTMLSpanElement>();
        if(textBlock.textContent.returns)
            textBlock.textContent.returns('');

        return textBlock;
    }

    protected static createTextBlock(text: string) {
        const textBlock = Substitute.for<HTMLSpanElement>();
        if(textBlock.textContent.returns)
            textBlock.textContent.returns(text);

        return textBlock;
    }

    protected static createEmptyEmojiTextBlock() {
        const emptyEmojiTextBlock = Substitute.for<HTMLDivElement>();
        emptyEmojiTextBlock.getAttribute('aria-label').returns(null);

        const textBlock = Substitute.for<HTMLDivElement>();
        textBlock.querySelector('div').returns(emptyEmojiTextBlock);

        return textBlock;
    }

    protected static createEmojiTextBlock(emoji: string) {
        const emojiTextBlock = Substitute.for<HTMLDivElement>();
        emojiTextBlock.getAttribute('aria-label').returns(emoji);

        const textBlock = Substitute.for<HTMLDivElement>();
        textBlock.querySelector('div').returns(emojiTextBlock);

        return textBlock;
    }

    public withEmptyTweetText() {
        this.containerElem.$(TweetText)
            .returns(Promise.resolve(NULL));

        return this;
    }

    public withTweetImages(tweetImageSrcs: string[]) {
        this.containerElem.$$eval(TweetImage, Arg.any())
            .returns(Promise.resolve(tweetImageSrcs));

        return this;
    }

    public withTweetVideo(videoSrc: string) {
        this.containerElem.$eval(TweetVideo, Arg.any())
            .returns(Promise.resolve(videoSrc));

        return this;
    }
}
