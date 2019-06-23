import UsernamePasswordCredentials from './username-password-credentials';
import SuccessCallback from './success-callback';
import ErrorCallback from './error-callback';

export default interface TwitterBookmarksExtractionTaskOptions {
    readonly credentials: UsernamePasswordCredentials;
    readonly fileName: string | null;
    readonly maxLimit: number;
    readonly chromePath: string | null;
    readonly manualQuit: boolean;
    readonly successCallback: SuccessCallback;
    readonly errorCallback: ErrorCallback;
}
