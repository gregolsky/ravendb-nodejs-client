import * as stream from "readable-stream";
import { RavenCommand } from "../../../Http/RavenCommand";
import { GetResponse } from "./GetResponse";
import { HttpCache } from "../../../Http/HttpCache";
import { HttpRequestParameters } from "../../../Primitives/Http";
import { GetRequest } from "./GetRequest";
import { ServerNode } from "../../../Http/ServerNode";
import { throwError } from "../../../Exceptions";
import { StatusCodes } from "../../../Http/StatusCode";
import { getEtagHeader } from "../../../Utility/HttpUtil";
import { RavenCommandResponsePipeline } from "../../../Http/RavenCommandResponsePipeline";

export class MultiGetCommand extends RavenCommand<GetResponse[]> {
    private _cache: HttpCache;
    private _commands: GetRequest[];
    private _baseUrl: string;

    public constructor(cache: HttpCache, commands: GetRequest[]) {
       super();
       this._cache = cache;
       this._commands = commands;
       this._responseType = "Raw";
   }

    private _getCacheKey(command: GetRequest): string {
        const url = this._baseUrl + command.urlAndQuery;
        return command.method + "-" + url;
    }

   public createRequest(node: ServerNode): HttpRequestParameters {
       this._baseUrl = node.url + "/databases/" + node.database;

       const requests = [];
       const bodyObj = { Requests: requests };
       const request: HttpRequestParameters = { 
           uri: this._baseUrl + "/multi_get",
           method: "POST", 
           headers: this._getHeaders().withContentTypeJson().build(),
        };
       
       for (const command of this._commands) {
           const cacheKey = this._getCacheKey(command);
           let cacheItemInfo;
           this._cache.get(cacheKey, (itemInfo) => cacheItemInfo = itemInfo);
           const headers = {};
           if (cacheItemInfo.cachedChangeVector) {
               headers["If-None-Match"] = `"${cacheItemInfo.cachedChangeVector}"`;
           }

           Object.assign(headers, command.headers);
           const req = {
               Url: "/databases/" + node.database + command.url,
               Query: command.query,
               Method: command.method,
               Headers: headers,
               Content: command.body
           };
           
           requests.push(req);
       }

       request.body = JSON.stringify(bodyObj);

       return request;
   }

    public async setResponseAsync(bodyStream: stream.Stream, fromCache: boolean): Promise<string> {
        if (!bodyStream) {
            this._throwInvalidResponse();
        }

        return RavenCommandResponsePipeline.create()
            .parseJsonAsync([ "Results", true ])
            .streamKeyCaseTransform({
                defaultTransform: "camel",
                paths: [
                    {
                        path: /result\.(results|includes)/,
                        transform: "camel"
                    }
                ]
            })
            .collectResult({
                initResult: [] as GetResponse[],
                reduceResults: (result: GetResponse[], next: GetResponse, i) => {
                    const command = this._commands[i];
                    this._maybeSetCache(next, command);
                    this._maybeReadFromCache(next, command);
                    return [...result, next] as GetResponse[];
                }
            })
            .process(bodyStream)
            .then(pipelineResult => {
                this.result = (pipelineResult.result as object[])
                    .map(x => GetResponse.create(x));
                return null;
            });
    }

    private _maybeReadFromCache(getResponse: GetResponse, command: GetRequest): void {
       if (getResponse.statusCode !== StatusCodes.NotModified) {
           return;
       }

       const cacheKey = this._getCacheKey(command);
       let cachedResponse;
       this._cache.get(cacheKey, x => cachedResponse = x.response);
       getResponse.result = cachedResponse;
    }

    private _maybeSetCache(getResponse: GetResponse, command: GetRequest): void {
        if (getResponse.statusCode === StatusCodes.NotModified) {
            return;
        }

        const cacheKey = this._getCacheKey(command);
        const result = getResponse.result;
        if (!result) {
            return;
        }

        const changeVector = getEtagHeader(getResponse.headers);
        if (!changeVector) {
            return;
        }

        this._cache.set(cacheKey, changeVector, result);
    }

    public get isReadRequest(): boolean {
        return false;
    }
}