import * as assert from "assert";
import { testContext, disposeTestDocumentStore } from "../Utils/TestUtil";

import {
    IDocumentStore,
    PatchOperation,
    PatchByQueryOperation,
} from "../../src";
import { User } from "../Assets/Entities";
import { PatchRequest } from "../../src/Documents/Operations/PatchRequest";

describe("PatchTest", function () {

    let store: IDocumentStore;

    beforeEach(async function () {
        store = await testContext.getDocumentStore();
    });

    afterEach(async () => 
        await disposeTestDocumentStore(store));

    it("can patch single document", async () => {
        {
            const session = store.openSession();
            const user = new User();
            user.name = "RavenDB";

            await session.store(user, "users/1");
            await session.saveChanges();
        }

        const patchOperation = new PatchOperation(
            "users/1", 
            null,
            PatchRequest.forScript("this.name = \"Patched\""));
        const patchResult = await store.operations.send(patchOperation);
        assert.ok(patchResult.document);
        assert.equal(patchResult.document["name"], "Patched");
        assert.equal(patchResult.status, "Patched");

        { 
            const session = store.openSession();
            const user = await session.load<User>("users/1");
            assert.equal(user.name, "Patched");
        }
    });

    // TODO: waiting for session.advanced.patch
    it.skip("can wait for index after patch", async () => {
        //TODO: new IndexesFromClientTest.Users_ByName().execute(store);
        {
            const session = store.openSession();
            const user = new User();
            user.name = "RavenDB";

            await session.store(user, "users/1");
            await session.saveChanges();
        }

        {
            const session = store.openSession();
            session.advanced.waitForIndexesAfterSaveChanges({
                indexes: [ "Users/ByName"]
            });

            const user = await session.load<User>("users/1");
            //TODO: session.advanced.patch(user, "name", "New Name");
            await session.saveChanges();
        }
    });

    it("can patch multiple documents", async () => {
        {
            const session = store.openSession();
            const user = new User();
            user.name = "RavenDB";

            await session.store(user, "users/1");
            await session.saveChanges();
        }

        const patchOperation = new PatchByQueryOperation("from Users update {  this.name= \"Patched\"  }");
        const op = await store.operations.send(patchOperation);
        await op.waitForCompletion();

        { 
            const session = store.openSession();
            const user = await session.load<User>("users/1");
            assert.equal(user.name, "Patched");
        }
    });

    it("throws on invalid script", async () => {
        {
            const session = store.openSession();
            const user = new User();
            user.name = "RavenDB";

            await session.store(user, "users/1");
            await session.saveChanges();
        }

        const patchOperation = new PatchByQueryOperation("from Users update { throw 5; }");
        const op = await store.operations.send(patchOperation);
        try {
            await op.waitForCompletion();
        } catch (err) {
            assert.equal(err.name, "JavaScriptException");
            return;
        }

        assert.fail("it should have thrown");
    });
});
