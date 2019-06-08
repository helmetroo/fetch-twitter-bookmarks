import { ParsedArgs } from 'minimist';

export default interface UsernamePasswordCredentials extends ParsedArgs {
    username: string;
    password: string;
}
