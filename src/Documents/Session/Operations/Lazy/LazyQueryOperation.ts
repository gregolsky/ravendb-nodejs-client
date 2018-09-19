import { ILazyOperation } from "./ILazyOperation";
import { ObjectTypeDescriptor } from "../../../../Types";
import { QueryResult } from "../../../Queries/QueryResult";
import { QueryOperation } from "../QueryOperation";
import { DocumentConventions } from "../../../Conventions/DocumentConventions";
import { GetRequest } from "../../../Commands/MultiGet/GetRequest";
import { writeIndexQuery } from "../../../Queries/IndexQuery";
import { GetResponse } from "../../../Commands/MultiGet/GetResponse";
import { QueryCommand } from "../../../Commands/QueryCommand";
import { stringToReadable } from "../../../../Utility/StreamUtil";
import { TypesAwareObjectMapper } from "../../../../Mapping/ObjectMapper";

export class LazyQueryOperation<T extends object> implements ILazyOperation {
    private readonly _clazz: ObjectTypeDescriptor<T>;
    private readonly _conventions: DocumentConventions;
    private readonly _queryOperation: QueryOperation;
    private readonly _afterQueryExecuted: Array<(result: QueryResult) => void>;
    public constructor(
        conventions: DocumentConventions,
        queryOperation: QueryOperation,
        afterQueryExecuted: Array<(result: QueryResult) => void>,
        clazz: ObjectTypeDescriptor<T>) {

        this._clazz = clazz;
        this._conventions = conventions;
        this._queryOperation = queryOperation;
        this._afterQueryExecuted = afterQueryExecuted;
    }

    public createRequest(): GetRequest {
        const request = new GetRequest();
        request.url = "/queries";
        request.method = "POST";
        request.query = "?queryHash=" + this._queryOperation.indexQuery.getQueryHash();
        request.body = writeIndexQuery(this._conventions, this._queryOperation.indexQuery);
        return request;
    }

    private _result: object;
    private _queryResult: QueryResult;
    private _requiresRetry: boolean;

    public get result(): any {
        return this._result;
    }

    public set result(result) {
        this._result = result;
    }

    public get queryResult(): QueryResult {
        return this._queryResult;
    }

    public set queryResult(queryResult) {
        this._queryResult = queryResult;
    }

    public get requiresRetry() {
        return this._requiresRetry;
    }

    public set requiresRetry(result) {
        this._requiresRetry = result;
    }

    public async handleResponseAsync(response: GetResponse): Promise<void> {
        if (response.forceRetry) {
            this._result = null;
            this._requiresRetry = true;
            return;
        }

        const result = await QueryCommand.parseQueryResultResponseAsync(
            stringToReadable(response.result), this._conventions, false, new TypesAwareObjectMapper());
        this._handleResponse(result);
    }

    private _handleResponse(queryResult: QueryResult): void {
        this._queryOperation.ensureIsAcceptableAndSaveResult(queryResult);
        // TODO this._afterQueryExecuted, queryResult);
        this.result = this._queryOperation.complete(this._clazz);
        this.queryResult = queryResult;
    }
}
