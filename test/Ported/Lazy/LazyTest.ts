import {EntitiesCollectionObject, IDocumentStore} from "../../../src";
import {disposeTestDocumentStore, testContext} from "../../Utils/TestUtil";
import {Company, Order, User} from "../../Assets/Entities";
import {Lazy} from "../../../src/Documents/Lazy";
import * as assert from "assert";

describe("LazyTest", function () {

    let store: IDocumentStore;

    beforeEach(async function () {
        store = await testContext.getDocumentStore();
    });

    afterEach(async () =>
        await disposeTestDocumentStore(store));

    it("can lazily load entity", async () => {
        {
            const session = store.openSession();
            for (let i = 1; i <= 6; i++) {
                const company = new Company();
                company.id = "companies/" + i;
                await session.store(company, "companies/" + i);
            }
            await session.saveChanges();
        }

        {
            const session = store.openSession();
            let lazyOrder: Lazy<Order> = session.advanced.lazily.load<Company>("companies/1");
            assert.ok(!lazyOrder.isValueCreated());

            let order = await lazyOrder.getValue();
            assert.strictEqual(order.id, "companies/1");
            const lazyOrders: Lazy<EntitiesCollectionObject<Company>>
                = session.advanced.lazily.load<Company>(["companies/1", "companies/2"]);
            assert.ok(!lazyOrders.isValueCreated());
            const orders = await lazyOrders.getValue();
            assert.strictEqual(Object.keys(orders).length, 2);

            const company1 = orders["companies/1"];
            const company2 = orders["companies/2"];
            assert.ok(company1);
            assert.ok(company2);

            assert.strictEqual(company1.id, "companies/1");
            assert.strictEqual(company2.id, "companies/2");

            lazyOrder = session.advanced.lazily.load<Company>("companies/3");
            assert.ok(!lazyOrder.isValueCreated());
            order = await lazyOrder.getValue();
            assert.strictEqual(order.id, "companies/3");

            const load: Lazy<EntitiesCollectionObject<Company>>
                = session.advanced.lazily.load<Company>(["no_such_1", "no_such_2"]);
            const missingItems = await load.getValue();
            assert.ok(!missingItems["no_such_1"]);
            assert.ok(!missingItems["no_such_2"]);
        }
    });

    it("can execute all pending lazy operations", async () => {
        {
            const session = store.openSession();
            const company1 = new Company();
            company1.id = "companies/1";
            await session.store(company1, "companies/1");
            const company2 = new Company();
            company2.id = "companies/2";
            await session.store(company2, "companies/2");
            await session.saveChanges();
        }

        {
            let company1Ref: Company;
            let company2Ref: Company;
            const session = store.openSession();

            const company1Lazy: Lazy<Company> = session.advanced.lazily.load<Company>("companies/1");
            company1Lazy.getValue().then(x => company1Ref = x);

            const company2Lazy: Lazy<Company> = session.advanced.lazily.load<Company>("companies/2");
            company2Lazy.getValue().then(x => company2Ref = x);

            assert.ok(!company1Lazy.isValueCreated());
            assert.ok(!company2Lazy.isValueCreated());

            await session.advanced.eagerly.executeAllPendingLazyOperations();

            assert.ok(company1Lazy.isValueCreated());
            assert.ok(company2Lazy.isValueCreated());
            assert.strictEqual(company1Ref.id, "companies/1");
            assert.strictEqual(company2Ref.id, "companies/2");
        }
    });

    it("can execute queued action when load", async () => {
        {
            const session = store.openSession();
            const user = new User();
            user.lastName = "Oren";
            await session.store(user, "users/1");
            await session.saveChanges();
        }

        {
            const session = store.openSession();
            let user: User;
            const lazy: Lazy<User> = session.advanced.lazily.load<User>("users/1");
            lazy.getValue().then(x => user = x);

            await session.advanced.eagerly.executeAllPendingLazyOperations();
            assert.ok(user);
        }
    });

    it("can use cache with lazy loading", async () => {
        {
            const session = store.openSession();
            const user = new User();
            user.lastName = "Oren";
            await session.store(user, "users/1");
            await session.saveChanges();
        }

        {
            const session = store.openSession();
            const lazy: Lazy<User> = session.advanced.lazily.load<User>("users/1");
            await lazy.getValue();
        }

        {
            const session = store.openSession();
            const lazy: Lazy<User> = session.advanced.lazily.load<User>("users/1");
            const user = await lazy.getValue();
            assert.strictEqual(user.lastName, "Oren");
        }
    });
});