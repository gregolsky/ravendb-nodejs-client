import { ObjectTypeDescriptor, EntitiesCollectionObject } from "../../../Types";
import { Lazy } from "../../Lazy";

export interface ILazyLoaderWithInclude {
     //TBD expr overrides with expressions + maybe we TInclude, see:

    /**
     * Begin a load while including the specified path
     * @param path Path in documents in which server should look for a 'referenced' documents.
     */
    include(path: string): ILazyLoaderWithInclude;

    // /**
    //  * Loads the specified entities with the specified ids.
    //  * @param clazz Result class
    //  * @param ids  Ids that should be loaded
    //  * @param <T> Result class
    //  */
    // load<T extends object>(...ids: string[], clazz: ObjectTypeDescriptor<T>): Lazy<Map<String, T>>;

    /**
     * Loads the specified ids.
     * @param <TResult> Result class
     * @param clazz Result class
     * @param ids Ids to load
     * @return Lazy Map: id to entity
     */
    load<TResult extends object>(
        ids: string[], clazz: ObjectTypeDescriptor<TResult>): Lazy<EntitiesCollectionObject<TResult>>;

    /**
     * Loads the specified entity with the specified id.
     * @param clazz Result class
     * @param id Identifier of document
     * @param <TResult> Result class
     */
    load<TResult extends object>(id: string, clazz: ObjectTypeDescriptor<TResult>): Lazy<TResult>;
}