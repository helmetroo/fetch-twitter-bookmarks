import type { Config } from '@jest/types';
import NodeEnvironment from 'jest-environment-node';

import fetchAvailableBrowsers from '../utils/fetch-available-browsers';

require('ts-node/register');

export default class CustomEnvironment extends NodeEnvironment {
    constructor(config: Config.ProjectConfig) {
        super(config);
    }

    async setup() {
        await super.setup();
        this.global.availableBrowsers = await fetchAvailableBrowsers();
    }
}
