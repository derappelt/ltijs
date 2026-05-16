import mongoose from 'mongoose';
import { DatabaseConfig } from '../types/shared';
interface EncryptedPayload {
    iv: string;
    data: string;
}
/**
 * @description Collection of static methods to manipulate the database.
 */
declare class Database {
    #private;
    db: mongoose.Connection;
    /**
     * @description Mongodb configuration setup
     * @param {Object} database - Configuration object
     */
    constructor(database: DatabaseConfig);
    /**
     * @description Opens connection to database
     */
    setup(): Promise<boolean>;
    Close(): Promise<boolean>;
    /**
     * @description Get item or entire database.
     * @param {String} ENCRYPTIONKEY - Encryptionkey of the database, false if none
     * @param {String} collection - The collection to be accessed inside the database.
     * @param {Object} [query] - Query for the item you are looking for in the format {type: "type1"}.
     */
    Get(ENCRYPTIONKEY: string | false, collection: string, query?: Record<string, unknown>): Promise<any[] | false>;
    /**
     * @description Insert item in database.
     * @param {String} ENCRYPTIONKEY - Encryptionkey of the database, false if none.
     * @param {String} collection - The collection to be accessed inside the database.
     * @param {Object} item - The item Object you want to insert in the database.
     * @param {Object} [index] - Key that should be used as index in case of Encrypted document.
     */
    Insert(ENCRYPTIONKEY: string | false, collection: string, item: Record<string, unknown>, index?: Record<string, unknown>): Promise<boolean>;
    /**
     * @description Replace item in database. Creates a new document if it does not exist.
     * @param {String} ENCRYPTIONKEY - Encryptionkey of the database, false if none.
     * @param {String} collection - The collection to be accessed inside the database.
     * @param {Object} query - Query for the item you are looking for in the format {type: "type1"}.
     * @param {Object} item - The item Object you want to insert in the database.
     * @param {Object} [index] - Key that should be used as index in case of Encrypted document.
     */
    Replace(ENCRYPTIONKEY: string | false, collection: string, query: Record<string, unknown>, item: Record<string, unknown>, index?: Record<string, unknown>): Promise<boolean>;
    /**
     * @description Assign value to item in database
     * @param {String} ENCRYPTIONKEY - Encryptionkey of the database, false if none.
     * @param {String} collection - The collection to be accessed inside the database.
     * @param {Object} query - The entry you want to modify in the format {type: "type1"}.
     * @param {Object} modification - The modification you want to make in the format {type: "type2"}.
     */
    Modify(ENCRYPTIONKEY: string | false, collection: string, query: Record<string, unknown>, modification: Record<string, unknown>): Promise<boolean>;
    /**
     * @description Delete item in database
     * @param {String} collection - The collection to be accessed inside the database.
     * @param {Object} query - The entry you want to delete in the format {type: "type1"}.
     */
    Delete(collection: string, query: Record<string, unknown>): Promise<boolean>;
    /**
     * @description Encrypts data.
     * @param {String} data - Data to be encrypted
     * @param {String} secret - Secret used in the encryption
     */
    Encrypt(data: string, secret: string): Promise<EncryptedPayload>;
    /**
     * @description Decrypts data.
     * @param {String} data - Data to be decrypted
     * @param {String} _iv - Encryption iv
     * @param {String} secret - Secret used in the encryption
     */
    Decrypt(data: string, _iv: string, secret: string): Promise<string>;
}
export = Database;
//# sourceMappingURL=Database.d.ts.map