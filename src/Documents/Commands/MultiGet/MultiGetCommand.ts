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
        if (this._responseType === "Empty" || this._responseType === "Raw") {
            this._throwInvalidResponse();
        }

        return throwError("NotSupportedException",
            this.constructor.name +
            " command must override the setResponseAsync()" +
            " method which expects response with the following type: " +
            this._responseType);
    }

    private _maybeReadFromCache(getResponse: GetResponse, command: GetRequest): void {
       if (getResponse.statusCode !== StatusCodes.NotModified) {
           return;
       }

       const cacheKey = this._getCacheKey(command);
       let cachedResponse;
       this._cache.get(cacheKey, _ => cachedResponse = _.response);
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

//    public setResponseRaw(CloseableHttpResponse response, InputStream stream): void {
//        try (JsonParser parser = mapper.getFactory().createParser(stream)) {
//            if (parser.nextToken() != JsonToken.START_OBJECT) {
//                throwInvalidResponse();
//            }
//             String property = parser.nextFieldName();
//            if (!"Results".equals(property)) {
//                throwInvalidResponse();
//            }
//             int i = 0;
//            result = new ArrayList<>();
//             for (GetResponse getResponse : readResponses(mapper, parser)) {
//                GetRequest command = _commands.get(i);
//                maybeSetCache(getResponse, command);
//                maybeReadFromCache(getResponse, command);
//                 result.add(getResponse);
//                 i++;
//            }
//             if (parser.nextToken() != JsonToken.END_OBJECT) {
//                throwInvalidResponse();
//            }
//         } catch (Exception e) {
//            throwInvalidResponse(e);
//        }
//    }
//     private static List<GetResponse> readResponses(ObjectMapper mapper, JsonParser parser) throws IOException {
//        if (parser.nextToken() != JsonToken.START_ARRAY) {
//            throwInvalidResponse();
//        }
//         List<GetResponse> responses = new ArrayList<>();
//         while (true) {
//            if (parser.nextToken() == JsonToken.END_ARRAY) {
//                break;
//            }
//             responses.add(readResponse(mapper, parser));
//        }
//         return responses;
//    }
//     private static GetResponse readResponse(ObjectMapper mapper, JsonParser parser) throws IOException {
//        if (parser.currentToken() != JsonToken.START_OBJECT) {
//            throwInvalidResponse();
//        }
//         GetResponse getResponse = new GetResponse();
//         while (true) {
//            if (parser.nextToken() == null) {
//                throwInvalidResponse();
//            }
//             if (parser.currentToken() == JsonToken.END_OBJECT) {
//                break;
//            }
//             if (parser.currentToken() != JsonToken.FIELD_NAME) {
//                throwInvalidResponse();
//            }
//             String property = parser.getValueAsString();
//            switch (property) {
//                case "Result":
//                    JsonToken jsonToken = parser.nextToken();
//                    if (jsonToken == null) {
//                        throwInvalidResponse();
//                    }
//                     if (parser.currentToken() == JsonToken.VALUE_NULL) {
//                        continue;
//                    }
//                     if (parser.currentToken() != JsonToken.START_OBJECT) {
//                        throwInvalidResponse();
//                    }
//                     TreeNode treeNode = mapper.readTree(parser);
//                    getResponse.setResult(treeNode.toString());
//                    continue;
//                case "Headers":
//                    if (parser.nextToken() == null) {
//                        throwInvalidResponse();
//                    }
//                     if (parser.currentToken() == JsonToken.VALUE_NULL) {
//                        continue;
//                    }
//                     if (parser.currentToken() != JsonToken.START_OBJECT) {
//                        throwInvalidResponse();
//                    }
//                     ObjectNode headersMap = mapper.readTree(parser);
//                    headersMap.fieldNames().forEachRemaining(field -> {
//                        getResponse.getHeaders().put(field, headersMap.get(field).asText());
//                    });
//                    continue;
//                case "StatusCode":
//                    int statusCode = parser.nextIntValue(-1);
//                    if (statusCode == -1) {
//                        throwInvalidResponse();
//                    }
//                     getResponse.setStatusCode(statusCode);
//                    continue;
//                default:
//                    throwInvalidResponse();
//                    break;
//             }
//         }
//         return getResponse;
//    }
}