import * as stream from "readable-stream";
import { RavenCommandResponsePipeline } from "../../../Http/RavenCommandResponsePipeline";
import { pick } from "stream-json/filters/Pick";
import { ignore } from "stream-json/filters/Ignore";
import { streamArray } from "stream-json/streamers/StreamArray";
import { streamObject } from "stream-json/streamers/StreamObject";
import { streamValues } from "stream-json/streamers/StreamValues";
import { DocumentConventions } from "../../../Documents/Conventions/DocumentConventions";

export function parseDocumentResults<TResult>(
    bodyStream: stream.Stream,
    conventions: DocumentConventions,
    bodyCallback?: (body: string) => void): Promise<TResult> {

    return RavenCommandResponsePipeline.create<object[]>()
        .collectBody(bodyCallback)
        .parseJsonAsync2([
            pick({ filter: "Results" }),
            streamArray()
        ])
        .streamKeyCaseTransform(conventions.entityFieldNameConvention, "DOCUMENT_LOAD")
        .collectResult((result, next) => [...result, next["value"]], [])
        .process(bodyStream);
}
        
export function parseRestOfOutput(
    bodyStream: stream.Stream,
    ignoreFields: string | RegExp): Promise<object> {
    return RavenCommandResponsePipeline.create()
        .parseJsonAsync2([
            ignore({ filter: ignoreFields }),
            streamValues()
        ])
        .streamKeyCaseTransform("camel")
        .process(bodyStream);
}

export function parseDocumentIncludes(
    bodyStream: stream.Stream,
    conventions: DocumentConventions) {
    return RavenCommandResponsePipeline.create<{ [key: string]: object }>()
            .parseJsonAsync2([
                pick({ filter: "Includes" }),
                streamObject()
            ])
            .streamKeyCaseTransform(conventions.entityFieldNameConvention, "DOCUMENT_LOAD")
            .collectResult((result, next) => {
                result[next["key"]] = next["value"];
                return result;
            }, {})
            .process(bodyStream);
}
