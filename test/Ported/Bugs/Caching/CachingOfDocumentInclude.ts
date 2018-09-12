import {IDocumentStore} from "../../../../src";
import {disposeTestDocumentStore, testContext} from "../../../Utils/TestUtil";
import * as assert from "assert";
import {Lazy} from "../../../../src/Documents/Lazy";

export class User {
    public id: string;
    public name: string;
    public partnerId: string;
    public email: string;
    public tags: string[];
    public age: number;
    public active: boolean;
}

describe("CachingOfDocumentInclude", function () {

    let store: IDocumentStore;

    beforeEach(async function () {
        store = await testContext.getDocumentStore();
    });

    afterEach(async () =>
        await disposeTestDocumentStore(store));

    it("can cache document with includes", async () => {
        {
            const session = store.openSession();
            const user = new User();
            user.name = "Ayende";
            await session.store(user);

            const partner = new User();
            partner.partnerId = "users/1-A";
            await session.store(partner);

            await session.saveChanges();
        }

        {
            const session = store.openSession();
            await session.include("partnerId")
                .load<User>("users/2-A");
            await session.saveChanges();
        }

        {
            const session = store.openSession();
            await session.include("partnerId")
                .load<User>("users/2-A");
            assert.strictEqual(session.advanced.requestExecutor.cache.numberOfItems, 1);
        }
    });

    it("can avoid using server for load with include if everything is in session cache", async () => {
        {
            const session = store.openSession();
            const user = new User();
            user.name = "Ayende";
            await session.store(user);

            const partner = new User();
            partner.partnerId = "users/1-A";
            await session.store(partner);

            await session.saveChanges();
        }

        {
            const session = store.openSession();
            const user = await session.load<User>("users/2-A");
            await session.load<User>(user.partnerId);
            const old = session.advanced.numberOfRequests;
            const newUser = await session
                .include("partnerId")
                .load<User>("users/2-A");
            assert.strictEqual(session.advanced.numberOfRequests, old);
        }
    });

    it("can avoid using server for load with include if everything is in session cache lazy", async () => {
        {
            const session = store.openSession();
            const user = new User();
            user.name = "Ayende";
            await session.store(user);

            const partner = new User();
            partner.partnerId = "users/1-A";
            await session.store(partner);

            await session.saveChanges();
        }

        {
            const session = store.openSession();
            session.advanced.lazily.load<User>("users/2-A");
            session.advanced.lazily.load<User>("users/1-A");
            await session.advanced.eagerly.executeAllPendingLazyOperations();

            const old = session.advanced.numberOfRequests;
            const result1: Lazy<User> = session.advanced.lazily
                .include("partnerId")
                .load<User>("users/2-A");

            const user = await result1.getValue();
            assert.ok(user);
            assert.strictEqual(session.advanced.numberOfRequests, old);
        }
    });
});
// public class CachingOfDocumentInclude extends RemoteTestBase {
//      @Test
//     public void can_avoid_using_server_for_load_with_include_if_everything_is_in_session_cache() throws Exception {
//         try (IDocumentStore store = getDocumentStore()) {
//             try (IDocumentSession session = store.openSession()) {
//                 User user = new User();
//                 user.setName("Ayende");
//                 session.store(user);
//                  User partner = new User();
//                 partner.setPartnerId("users/1-A");
//                 session.store(partner);
//                  session.saveChanges();
//             }
//              try (IDocumentSession session = store.openSession()) {
//                 User user = session.load(User.class, "users/2-A");
//                  session.load(User.class, user.getPartnerId());
//                  int old = session.advanced().getNumberOfRequests();
//                  User res = session.include("partnerId")
//                         .load(User.class, "users/2-A");
//                  assertThat(session.advanced().getNumberOfRequests())
//                         .isEqualTo(old);
//             }
//         }
//     }
//      @Test
//     public void can_avoid_using_server_for_multiload_with_include_if_everything_is_in_session_cache() throws Exception {
//         try (IDocumentStore store = getDocumentStore()) {
//             try (final IDocumentSession session = store.openSession()) {
//                 Consumer<String> storeUser = name -> {
//                     User user = new User();
//                     user.setName(name);
//                     session.store(user);
//                 };
//                  storeUser.accept("Additional");
//                 storeUser.accept("Ayende");
//                 storeUser.accept("Michael");
//                 storeUser.accept("Fitzhak");
//                 storeUser.accept("Maxim");
//                  User withPartner = new User();
//                 withPartner.setPartnerId("users/1-A");
//                 session.store(withPartner);
//                 session.saveChanges();
//             }
//              try (IDocumentSession session = store.openSession()) {
//                 User u2 = session.load(User.class, "users/2-A");
//                 User u6 = session.load(User.class, "users/6-A");
//                  ArrayList<String> inp = new ArrayList<>();
//                 inp.add("users/1-A");
//                 inp.add("users/2-A");
//                 inp.add("users/3-A");
//                 inp.add("users/4-A");
//                 inp.add("users/5-A");
//                 inp.add("users/6-A");
//                 Map<String, User> u4 = session.load(User.class, inp);
//                  session.load(User.class, u6.getPartnerId());
//                  int old = session.advanced().getNumberOfRequests();
//                  Map<String, User> res = session.include("partnerId")
//                         .load(User.class, "users/2-A", "users/3-A", "users/6-A");
//                  assertThat(session.advanced().getNumberOfRequests())
//                         .isEqualTo(old);
//              }
//         }
//     }
// }