import { injectable as Injectable } from 'inversify';

@Injectable()
export default abstract class AppInterface {
    public abstract async run(): Promise<void>;
}
