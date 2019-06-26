import ValidUsernamePasswordCredentials from './username-password-credentials';
import SuccessCallback from './success-callback';
import ErrorCallback from './error-callback';

export default interface TwitterBookmarksExtractionTaskOptions {
    readonly credentials: ValidUsernamePasswordCredentials;
    readonly fileName: string | null;
    readonly maxLimit: number;
    readonly chromePath: string | null;
    readonly manualQuit: boolean;
    readonly silent: boolean;
    readonly inspect: boolean;
    readonly successCallback: SuccessCallback;
    readonly errorCallback: ErrorCallback;
}
