import 'reflect-metadata';

import AppInterface from '@app-interfaces/app-interface';

import cliPuppeteerCtr from '@ioc-containers/cli-puppeteer-ioc-container';
import IOC_TOKENS from '@ioc-tokens';
const {
    AppInterface: AppInterfaceType
} = IOC_TOKENS;

const appInterface =
    cliPuppeteerCtr.get<AppInterface>(AppInterfaceType);
appInterface.run();
export default appInterface;
