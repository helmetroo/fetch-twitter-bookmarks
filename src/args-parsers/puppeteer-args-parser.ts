import PuppeteerArgs from '@args/puppeteer-args';

export default interface PuppeteerArgsParser {
    getPuppeteerArgs(): PuppeteerArgs;
}
