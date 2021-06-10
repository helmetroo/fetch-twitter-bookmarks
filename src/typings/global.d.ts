import { AvailableBrowser } from '../utils/fetch-available-browsers';

export {};

declare global {
    namespace NodeJS {
        interface Global {
            availableBrowsers: AvailableBrowser[]
        }
    }
}
