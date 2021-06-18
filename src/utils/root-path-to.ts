import { join } from 'path';
import rootPath from 'app-root-path';

export default function rootPathTo(path: string) {
    return join(rootPath.toString(), path);
}
