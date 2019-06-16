import UsernamePasswordCredentials from './username-password-credentials';
import ErrorCallback from './error-callback';

export default interface TwitterBookmarksExtractionTaskOptions {
    readonly credentials: UsernamePasswordCredentials;
    readonly fileName: string | null;
    readonly maxLimit: number;
    readonly chromePath: string | null;
    readonly errorCallback: ErrorCallback;
}
