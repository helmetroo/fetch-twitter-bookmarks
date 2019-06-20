import ProgressEventEmitter from './progress-event-emitter';

export default abstract class Progressable extends ProgressEventEmitter {
    public abstract get numEvents(): number;
    public abstract run(): void;
}
