import { promisify } from 'util';
import {
    access as accessCb,
    rename as renameCb,
    rm as rmCb,
    writeFile as writeFileCb,
} from 'fs';

export namespace PromisifiedFS {
    export const access = promisify(accessCb);
    export const rename = promisify(renameCb);
    export const rm = promisify(rmCb);
    export const write = promisify(writeFileCb);
}
