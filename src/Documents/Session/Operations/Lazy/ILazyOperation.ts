import { GetRequest } from "../../../Commands/MultiGet/GetRequest";
import { GetResponse } from "../../../Commands/MultiGet/GetResponse";
import { QueryResult } from "../../../../Documents/Queries/QueryResult";

export interface ILazyOperation {
    createRequest(): GetRequest;
    getResult(): Object;
    getQueryResult(): QueryResult;
    isRequiresRetry(): boolean;
    handleResponse(response: GetResponse): void;
}
