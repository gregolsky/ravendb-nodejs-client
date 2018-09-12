// public class MultiGetOperation {
//     //TBD: used in lazy execution
//     private final InMemoryDocumentSessionOperations _session;
//      public MultiGetOperation(InMemoryDocumentSessionOperations session) {
//         _session = session;
//     }
//      public MultiGetCommand createRequest(List<GetRequest> requests) {
//         return new MultiGetCommand(_session.getRequestExecutor().getCache(), requests);
//     }
//      public void setResult(ObjectNode result) {
//      }
// }