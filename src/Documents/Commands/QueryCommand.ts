import {HttpRequestParameters} from "../../Primitives/Http";
import { RavenCommand } from "../../Http/RavenCommand";
import { QueryResult } from "../Queries/QueryResult";
import { DocumentConventions } from "../Conventions/DocumentConventions";
import { IndexQuery, writeIndexQuery } from "../Queries/IndexQuery";
import { throwError } from "../../Exceptions";
import { ServerNode } from "../../Http/ServerNode";
import * as StringBuilder from "string-builder";
import {JsonSerializer } from "../../Mapping/Json/Serializer";
import * as stream from "readable-stream";
import { streamValues } from "stream-json/streamers/StreamValues";
import { streamArray } from "stream-json/streamers/StreamArray";
import { streamObject } from "stream-json/streamers/StreamObject";
import { pick } from "stream-json/filters/Pick";
import { ignore } from "stream-json/filters/Ignore";
import { parseDocumentResults, parseRestOfOutput, parseDocumentIncludes } from "../../Mapping/Json/Streams/Pipelines";

export interface QueryCommandOptions {
    metadataOnly?: boolean;
    indexEntriesOnly?: boolean;
}

export class QueryCommand extends RavenCommand<QueryResult> {

    protected _conventions: DocumentConventions;
    private _indexQuery: IndexQuery;
    private _metadataOnly: boolean;
    private _indexEntriesOnly: boolean;

    public constructor(
        conventions: DocumentConventions, indexQuery: IndexQuery, opts: QueryCommandOptions) {
        super();

        this._conventions = conventions;

        if (!indexQuery) {
            throwError("InvalidArgumentException", "indexQuery cannot be null.");
        }

        this._indexQuery = indexQuery;

        opts = opts || {};
        this._metadataOnly = opts.metadataOnly;
        this._indexEntriesOnly = opts.indexEntriesOnly;
    }

    public createRequest(node: ServerNode): HttpRequestParameters {
        this._canCache = !this._indexQuery.disableCaching;

        // we won't allow aggressive caching of queries with WaitForNonStaleResults
        this._canCacheAggressively = this._canCache && !this._indexQuery.waitForNonStaleResults;

        const path = new StringBuilder(node.url)
                .append("/databases/")
                .append(node.database)
                .append("/queries?queryHash=")
                // we need to add a query hash because we are using POST queries
                // so we need to unique parameter per query so the query cache will
                // work properly
                .append(this._indexQuery.getQueryHash());

        if (this._metadataOnly) {
            path.append("&metadataOnly=true");
        }

        if (this._indexEntriesOnly) {
            path.append("&debug=entries");
        }

        const uri = path.toString();
        const body = writeIndexQuery(this._conventions, this._indexQuery);
        const headers = this._getHeaders().withContentTypeJson().build();
        return {
            method: "POST",
            uri,
            headers,
            body
        };
    }

    protected get _serializer(): JsonSerializer {
        const serializer = super._serializer;
        return serializer;
    }

    public async setResponseAsync(bodyStream: stream.Stream, fromCache: boolean): Promise<string> {
        if (!bodyStream) {
            this.result = null;
            return;
        }

        let body;
        const resultsPromise = parseDocumentResults(bodyStream, this._conventions, b => body = b); 
        const includesPromise = parseDocumentIncludes(bodyStream, this._conventions); 
        const restPromise = parseRestOfOutput(bodyStream, /^Results|Includes$/);
        
        await Promise.all([ resultsPromise, includesPromise, restPromise ])
            .then(([results, includes, rest]) => {
                const rawResult = Object.assign({}, rest, { results, includes }) as QueryResult;
                this.result = this._reviveResultTypes(rawResult, {
                    typeName: QueryResult.name,
                    nestedTypes: {
                        indexTimestamp: "date",
                        lastQueryTime: "date"
                    }
                }, new Map([[QueryResult.name, QueryResult]]));

                if (fromCache) {
                    this.result.durationInMs = -1;
                }
            });

        return body;
    }

    public get isReadRequest(): boolean {
        return true;
    }
}

export class FacetQueryCommand extends QueryCommand {

    public async setResponseAsync(bodyStream: stream.Stream, fromCache: boolean): Promise<string> {
        if (!bodyStream) {
            this.result = null;
            return;
        }

        let body;
        const resultsPromise = this._pipeline<object[]>()
            .collectBody((_body) => body = _body)
            .parseJsonAsync([
                pick({ filter: "Results" }),
                streamArray()
            ])
            .streamKeyCaseTransform("camel", "DOCUMENT_LOAD") // we don't care about the case in facets
            .collectResult((result, next) => [...result, next["value"]], [])
            .process(bodyStream);

        const includesPromise = parseDocumentIncludes(bodyStream, this._conventions);
        const restPromise = parseRestOfOutput(bodyStream, /^Results|Includes$/);

        await Promise.all([ resultsPromise, includesPromise, restPromise ])
        .then(([ results, includes, rest ]) => {
            const rawResult = Object.assign({}, rest, { results, includes }) as QueryResult;
            this.result = this._reviveResultTypes(rawResult, {
                typeName: QueryResult.name
            }, new Map([[QueryResult.name, QueryResult]]));

            if (fromCache) {
                this.result.durationInMs = -1;
            }
        });

        return body;
    }
}
