import { ParsedArgs } from 'minimist';
import UsernamePasswordCredentials from './username-password-credentials';
import MaxTweetLimit from './max-tweet-limit';
import UseChromeExecutable from './use-chrome-executable';

export default interface CommandLineArgs
extends ParsedArgs
implements UsernamePasswordCredentials
implements MaxTweetLimit
implements UseChromeExecutable
{
}
