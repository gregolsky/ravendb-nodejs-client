import { 
    ObjectKeyCaseTransformStreamOptions, 
    ObjectKeyCaseTransformStream } from "../Mapping/Json/Streams/ObjectKeyCaseTransformStream";
import { 
    gatherJsonNotMatchingPath } from "../Mapping/Json/Streams";
import {
    ObjectKeyCaseTransformProfile,
    getObjectKeyCaseTransformProfile } from "../Mapping/Json/Conventions";
import { ObjectUtil, CasingConvention } from "../Utility/ObjectUtil";
import * as through2 from "through2";
import * as StreamUtil from "../Utility/StreamUtil";
import * as stream from "readable-stream";
import * as JSONStream from "JSONStream";
import { CollectResultStream, CollectResultStreamOptions } from "../Mapping/Json/Streams/CollectResultStream";
import { throwError } from "../Exceptions";

export interface RavenCommandResponsePipelineOptions<TResult, TStreamItem> {
    collectBody?: boolean;
    jsonAsync?: {
        resultsPath?: string | any[];
    };
    jsonSync?: boolean;
    streamKeyCaseTransform?: ObjectKeyCaseTransformStreamOptions;
    restKeyCaseTransform?: ObjectKeyCaseTransformStreamOptions;
    collectResult: CollectResultStreamOptions<TResult, TStreamItem>;
    transform?: stream.Stream;
} 

export interface IRavenCommandResponsePipelineResult<T> {
    result: T;
    body?: string;
    rest?: object;
}

export class RavenCommandResponsePipeline<TStreamResult, TChunk> {

    private _opts: RavenCommandResponsePipelineOptions<TStreamResult, TChunk>;

    private constructor() {
        this._opts = {
            collectResult: {
                initResult: {} as TStreamResult,
                reduceResults: (result, next) => Object.assign(result, next)
            }
        } as RavenCommandResponsePipelineOptions<TStreamResult, TChunk>;
    }

    public static create<TResult, TStreamItem>(): RavenCommandResponsePipeline<TResult, TStreamItem> {
        return new RavenCommandResponsePipeline();
    }

    public parseJsonAsync(jsonStreamOpts?: string | any[]) {
        this._opts.jsonAsync = jsonStreamOpts 
            ? { resultsPath: jsonStreamOpts }
            : {};
        return this;
    }

    public parseJsonSync() {
        this._opts.jsonSync = true;
        return this;
    }

    public collectBody() {
        this._opts.collectBody = true;
        return this;
    }

    public streamKeyCaseTransform(defaultTransform: CasingConvention, profile: ObjectKeyCaseTransformProfile);
    public streamKeyCaseTransform(opts: ObjectKeyCaseTransformStreamOptions);
    public streamKeyCaseTransform(
        opts: CasingConvention | ObjectKeyCaseTransformStreamOptions, 
        profile?: ObjectKeyCaseTransformProfile) {
        if (!opts) {
            throwError("InvalidArgumentException", "opts cannot be null.");
        }

        if (typeof opts === "string") {
            return getObjectKeyCaseTransformProfile(opts, profile);
        }

        if (!this._opts.jsonAsync && !this._opts.jsonSync) {
            throwError("InvalidOperationException", 
                "Cannot use key case transform without doing parseJson() or parseJsonAsync() first.");
        }

        this._opts.streamKeyCaseTransform = opts;
        return this;
    }

    public collectResult(opts: CollectResultStreamOptions<TStreamResult, TChunk>) {
        this._opts.collectResult = opts;
        return this;
    }

    public restKeyCaseTransform(opts: ObjectKeyCaseTransformStreamOptions) {
        this._opts.restKeyCaseTransform = opts;
        return this;
    }

    public customTransform(transform: stream.Stream) {
        this._opts.transform = transform;
        return this;
    }

    public process(src: stream.Stream): Promise<IRavenCommandResponsePipelineResult<TStreamResult>> {

        if (!src) {
            throwError("MappingError", "Body stream cannot be null.");
        }

        const opts = this._opts;
        const streams: stream.Stream[] = [ src ];
        let body;
        let restPromise = Promise.resolve<object>(null);

        if (opts.collectBody) {
            body = "";
            streams.push(through2(function (chunk, enc, callback) {
                body = body + chunk;
                callback(null, chunk);
            }));
        }

        if (opts.jsonAsync) {
            const jsonStream = JSONStream.parse(opts.jsonAsync.resultsPath);
            if (opts.jsonAsync.resultsPath) {
                restPromise = gatherJsonNotMatchingPath(jsonStream);

                if (opts.restKeyCaseTransform && opts.restKeyCaseTransform) {
                    restPromise = restPromise.then(data =>
                        ObjectUtil.transformObjectKeys(data, opts.restKeyCaseTransform));
                }
            }

            streams.push(jsonStream);
        } else if (opts.jsonSync) {
            let json = "";
            streams.push(through2.obj(
                function (chunk, enc, callback) { json += chunk.toString("utf8"); callback(); }, 
                function (callback) { 
                    let result;

                    try {
                        result = JSON.parse(json);
                    } catch (err) {
                        throwError("InvalidOperationException", `Error parsing response: '${json}'.`, err);
                    }

                    this.push(result); 
                    callback(); 
                }));
        }

        if (opts.streamKeyCaseTransform) {
            let handlePath = false;
            if (opts.jsonAsync && Array.isArray(opts.jsonAsync.resultsPath)) {
                const path = opts.jsonAsync.resultsPath;
                handlePath = !!path[path.length - 1]["emitPath"];
            }

            const keyCaseOpts = Object.assign({}, opts.streamKeyCaseTransform, { handlePath });
            streams.push(new ObjectKeyCaseTransformStream(keyCaseOpts));
        }

        if (opts.transform) {
            streams.push(opts.transform);
        }

        const collectResult = new CollectResultStream(opts.collectResult);
        streams.push(collectResult);
        const resultsPromise = collectResult.promise;

        return StreamUtil.pipelineAsync(...streams)
        .then(() => Promise.all([ resultsPromise, restPromise ])) 
        .then(([result, rest]) => {
            return {
                result,
                rest,
                body
            };
        });
    }
}
