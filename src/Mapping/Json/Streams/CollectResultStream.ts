import * as stream from "readable-stream";

export interface CollectResultStreamOptions<TResult, TItem> {
    reduceResults: (
        result: TResult,
        next: TItem, 
        index?: number) => TResult;
    initResult: TResult;
}

export function lastResult<TResult, TItem>(_: TResult, chunk: TItem) { 
    return chunk;
}

export class CollectResultStream<TResult, TItem> extends stream.Writable {

    private _resultIndex = 0;
    private _result: TResult; 
    private _reduceResults: (
        result: TResult, 
        next: TItem, 
        index?: number) => TResult;

    private _resultPromise = new Promise((resolve, reject) => {
        this._resolver = { resolve, reject };
    });

    private _resolver: { resolve: Function, reject: Function };

    get promise(): Promise<TResult> {
        return this._resultPromise as Promise<TResult>;
    }

    constructor(opts: CollectResultStreamOptions<TResult, TItem>) {
        super({ objectMode: true });

        super.once("finish", () => {
            this._resolver.resolve(this._result);
        });

        this._reduceResults = opts.reduceResults || lastResult as (result: TResult, item: TItem) => TResult;
        this._result = opts.initResult || null;
    }

    public static collectArray<TItem>(handleEmitPath?: boolean): CollectResultStreamOptions<TItem[], TItem> {
        return {
            initResult: [] as TItem[],
            reduceResults: (result: TItem[], n: TItem) => 
                [ ...result, handleEmitPath ? (n as any).value : n ]
        };
    }

    // tslint:disable-next-line:function-name
    public _write(chunk, enc, callback) {
        this._result = this._reduceResults(this._result, chunk, this._resultIndex);
        this._resultIndex++;
        callback();
    }
}