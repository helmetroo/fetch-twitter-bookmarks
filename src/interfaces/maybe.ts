// Adapted from https://codewithstyle.info/advanced-functional-programming-in-typescript-maybe-monad/
export type Nil = undefined | null;
export const isNil = (x: any): x is Nil =>
    (x === undefined) || (x === null);

export default class Maybe<T> {
    private constructor(private value: T | Nil) {}

    static some<T>(value: T) {
        if (!value) 
            throw new Error('Value must not be null or undefined');

        return new Maybe(value);
    }

    static none<T>() {
        return new Maybe<T>(null);
    }

    static fromValue<T>(value: T) {
        return isNil(value)
            ? Maybe.none<T>()
            : Maybe.some(value);
    }

    public getOrElse(defaultValue: T) {
        return isNil(this.value)
            ? defaultValue
            : this.value;
    }

    public map<R>(f: (wrapped: T) => R): Maybe<R> {
        if (isNil(this.value))
            return Maybe.none<R>();

        return Maybe.fromValue(f(this.value));
    }

    public flatMap<R>(f: (wrapped: T) => Maybe<R>): Maybe<R> {
        if (isNil(this.value))
            return Maybe.none<R>();

        return f(this.value);
    }

    public async mapAsync<R>(f: (wrapped: T) => Promise<R>): Promise<Maybe<R>> {
        if (isNil(this.value))
            return Maybe.none<R>();

        const resolvedValue = await f(this.value);
        return Maybe.fromValue(resolvedValue);
    }
}
