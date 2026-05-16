"use strict";
var __classPrivateFieldSet = (this && this.__classPrivateFieldSet) || function (receiver, state, value, kind, f) {
    if (kind === "m") throw new TypeError("Private method is not writable");
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
    return (kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value)), value;
};
var __classPrivateFieldGet = (this && this.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var _Database_dbUrl, _Database_dbConnection, _Database_deploy;
const mongoose_1 = __importDefault(require("mongoose"));
const crypto_1 = __importDefault(require("crypto"));
const debug_1 = __importDefault(require("debug"));
const Schema = mongoose_1.default.Schema;
const provDatabaseDebug = (0, debug_1.default)('provider:database');
/**
 * @description Collection of static methods to manipulate the database.
 */
class Database {
    /**
     * @description Mongodb configuration setup
     * @param {Object} database - Configuration object
     */
    constructor(database) {
        _Database_dbUrl.set(this, void 0);
        _Database_dbConnection.set(this, {
            useNewUrlParser: true,
            connectTimeoutMS: 300000,
            useUnifiedTopology: true
        });
        _Database_deploy.set(this, false);
        if (!database || !database.url)
            throw new Error('MISSING_DATABASE_CONFIG');
        // Configures database connection
        __classPrivateFieldSet(this, _Database_dbUrl, database.url, "f");
        if (database.debug)
            mongoose_1.default.set('debug', true);
        __classPrivateFieldSet(this, _Database_dbConnection, {
            ...__classPrivateFieldGet(this, _Database_dbConnection, "f"),
            ...database.connection
        }, "f");
        // Creating database schemas
        const idTokenSchema = new Schema({
            iss: String,
            user: String,
            userInfo: JSON,
            platformInfo: JSON,
            clientId: String,
            platformId: String,
            deploymentId: String,
            createdAt: { type: Date, expires: 3600 * 24, default: Date.now }
        });
        idTokenSchema.index({ iss: 1, clientId: 1, deploymentId: 1, user: 1 });
        const contextTokenSchema = new Schema({
            contextId: String,
            user: String,
            roles: [String],
            path: String,
            targetLinkUri: String,
            context: JSON,
            resource: JSON,
            custom: JSON,
            launchPresentation: JSON,
            messageType: String,
            version: String,
            deepLinkingSettings: JSON,
            lis: JSON,
            endpoint: JSON,
            namesRoles: JSON,
            createdAt: { type: Date, expires: 3600 * 24, default: Date.now }
        });
        contextTokenSchema.index({ contextId: 1, user: 1 });
        const platformSchema = new Schema({
            platformUrl: String,
            platformName: String,
            clientId: String,
            authEndpoint: String,
            accesstokenEndpoint: String,
            authorizationServer: String,
            kid: String,
            authConfig: {
                method: String,
                key: String
            }
        });
        platformSchema.index({ platformUrl: 1 });
        platformSchema.index({ kid: 1 }, { unique: true });
        platformSchema.index({ platformUrl: 1, clientId: 1 }, { unique: true });
        const platformStatusSchema = new Schema({
            id: String,
            active: { type: Boolean, default: false }
        });
        platformStatusSchema.index({ id: 1 }, { unique: true });
        const keySchema = new Schema({
            kid: String,
            platformUrl: String,
            clientId: String,
            iv: String,
            data: String
        });
        keySchema.index({ kid: 1 }, { unique: true });
        const accessTokenSchema = new Schema({
            platformUrl: String,
            clientId: String,
            scopes: String,
            iv: String,
            data: String,
            createdAt: { type: Date, expires: 3600, default: Date.now }
        });
        accessTokenSchema.index({ platformUrl: 1, clientId: 1, scopes: 1 }, { unique: true });
        const nonceSchema = new Schema({
            nonce: String,
            createdAt: { type: Date, expires: 10, default: Date.now }
        });
        nonceSchema.index({ nonce: 1 });
        const stateSchema = new Schema({
            state: String,
            query: JSON,
            createdAt: { type: Date, expires: 600, default: Date.now }
        });
        stateSchema.index({ state: 1 }, { unique: true });
        try {
            mongoose_1.default.model('idtoken', idTokenSchema);
            mongoose_1.default.model('contexttoken', contextTokenSchema);
            mongoose_1.default.model('platform', platformSchema);
            mongoose_1.default.model('platformStatus', platformStatusSchema);
            mongoose_1.default.model('privatekey', keySchema);
            mongoose_1.default.model('publickey', keySchema);
            mongoose_1.default.model('accesstoken', accessTokenSchema);
            mongoose_1.default.model('nonce', nonceSchema);
            mongoose_1.default.model('state', stateSchema);
        }
        catch (err) {
            provDatabaseDebug('Model already registered. Continuing');
        }
        this.db = mongoose_1.default.connection;
    }
    /**
     * @description Opens connection to database
     */
    async setup() {
        this.db.on('connected', async () => {
            provDatabaseDebug('Database connected');
        });
        this.db.once('open', async () => {
            provDatabaseDebug('Database connection open');
        });
        this.db.on('error', async () => {
            mongoose_1.default.disconnect();
        });
        this.db.on('reconnected', async () => {
            provDatabaseDebug('Database reconnected');
        });
        this.db.on('disconnected', async () => {
            provDatabaseDebug('Database disconnected');
            provDatabaseDebug('Attempting to reconnect');
            setTimeout(async () => {
                if (this.db.readyState === 0) {
                    try {
                        await mongoose_1.default.connect(__classPrivateFieldGet(this, _Database_dbUrl, "f"), __classPrivateFieldGet(this, _Database_dbConnection, "f"));
                    }
                    catch (err) {
                        provDatabaseDebug('Error in MongoDb connection: ' + err);
                    }
                }
            }, 1000);
        });
        if (this.db.readyState === 0)
            await mongoose_1.default.connect(__classPrivateFieldGet(this, _Database_dbUrl, "f"), __classPrivateFieldGet(this, _Database_dbConnection, "f"));
        __classPrivateFieldSet(this, _Database_deploy, true, "f");
        return true;
    }
    // Closes connection to the database
    async Close() {
        mongoose_1.default.connection.removeAllListeners();
        await mongoose_1.default.connection.close();
        __classPrivateFieldSet(this, _Database_deploy, false, "f");
        return true;
    }
    /**
     * @description Get item or entire database.
     * @param {String} ENCRYPTIONKEY - Encryptionkey of the database, false if none
     * @param {String} collection - The collection to be accessed inside the database.
     * @param {Object} [query] - Query for the item you are looking for in the format {type: "type1"}.
     */
    async Get(ENCRYPTIONKEY, collection, query) {
        if (!__classPrivateFieldGet(this, _Database_deploy, "f"))
            throw new Error('PROVIDER_NOT_DEPLOYED');
        if (!collection)
            throw new Error('MISSING_COLLECTION');
        const Model = mongoose_1.default.model(collection);
        const result = await Model.find(query).select('-__v -_id');
        if (ENCRYPTIONKEY) {
            for (const i in result) {
                const temp = result[i];
                result[i] = JSON.parse(await this.Decrypt(result[i].data, result[i].iv, ENCRYPTIONKEY));
                if (temp.createdAt) {
                    const createdAt = Date.parse(temp.createdAt);
                    result[i].createdAt = createdAt;
                }
            }
        }
        if (result.length === 0)
            return false;
        return result;
    }
    /**
     * @description Insert item in database.
     * @param {String} ENCRYPTIONKEY - Encryptionkey of the database, false if none.
     * @param {String} collection - The collection to be accessed inside the database.
     * @param {Object} item - The item Object you want to insert in the database.
     * @param {Object} [index] - Key that should be used as index in case of Encrypted document.
     */
    async Insert(ENCRYPTIONKEY, collection, item, index) {
        if (!__classPrivateFieldGet(this, _Database_deploy, "f"))
            throw new Error('PROVIDER_NOT_DEPLOYED');
        if (!collection || !item || (ENCRYPTIONKEY && !index))
            throw new Error('MISSING_PARAMS');
        const Model = mongoose_1.default.model(collection);
        let newDocData = item;
        if (ENCRYPTIONKEY) {
            const encrypted = await this.Encrypt(JSON.stringify(item), ENCRYPTIONKEY);
            newDocData = {
                ...index,
                iv: encrypted.iv,
                data: encrypted.data
            };
        }
        const newDoc = new Model(newDocData);
        await newDoc.save();
        return true;
    }
    /**
     * @description Replace item in database. Creates a new document if it does not exist.
     * @param {String} ENCRYPTIONKEY - Encryptionkey of the database, false if none.
     * @param {String} collection - The collection to be accessed inside the database.
     * @param {Object} query - Query for the item you are looking for in the format {type: "type1"}.
     * @param {Object} item - The item Object you want to insert in the database.
     * @param {Object} [index] - Key that should be used as index in case of Encrypted document.
     */
    async Replace(ENCRYPTIONKEY, collection, query, item, index) {
        if (!__classPrivateFieldGet(this, _Database_deploy, "f"))
            throw new Error('PROVIDER_NOT_DEPLOYED');
        if (!collection || !item || (ENCRYPTIONKEY && !index))
            throw new Error('MISSING_PARAMS');
        const Model = mongoose_1.default.model(collection);
        let newDocData = item;
        if (ENCRYPTIONKEY) {
            const encrypted = await this.Encrypt(JSON.stringify(item), ENCRYPTIONKEY);
            newDocData = {
                ...index,
                iv: encrypted.iv,
                data: encrypted.data
            };
        }
        await Model.replaceOne(query, newDocData, { upsert: true });
        return true;
    }
    /**
     * @description Assign value to item in database
     * @param {String} ENCRYPTIONKEY - Encryptionkey of the database, false if none.
     * @param {String} collection - The collection to be accessed inside the database.
     * @param {Object} query - The entry you want to modify in the format {type: "type1"}.
     * @param {Object} modification - The modification you want to make in the format {type: "type2"}.
     */
    async Modify(ENCRYPTIONKEY, collection, query, modification) {
        if (!__classPrivateFieldGet(this, _Database_deploy, "f"))
            throw new Error('PROVIDER_NOT_DEPLOYED');
        if (!collection || !query || !modification)
            throw new Error('MISSING_PARAMS');
        const Model = mongoose_1.default.model(collection);
        let newMod = modification;
        if (ENCRYPTIONKEY) {
            let result = await Model.findOne(query);
            if (result) {
                result = JSON.parse(await this.Decrypt(result.data, result.iv, ENCRYPTIONKEY));
                result[Object.keys(modification)[0]] = Object.values(modification)[0];
                newMod = await this.Encrypt(JSON.stringify(result), ENCRYPTIONKEY);
            }
        }
        await Model.updateOne(query, newMod);
        return true;
    }
    /**
     * @description Delete item in database
     * @param {String} collection - The collection to be accessed inside the database.
     * @param {Object} query - The entry you want to delete in the format {type: "type1"}.
     */
    async Delete(collection, query) {
        if (!__classPrivateFieldGet(this, _Database_deploy, "f"))
            throw new Error('PROVIDER_NOT_DEPLOYED');
        if (!collection || !query)
            throw new Error('MISSING_PARAMS');
        const Model = mongoose_1.default.model(collection);
        await Model.deleteMany(query);
        return true;
    }
    /**
     * @description Encrypts data.
     * @param {String} data - Data to be encrypted
     * @param {String} secret - Secret used in the encryption
     */
    async Encrypt(data, secret) {
        const hash = crypto_1.default.createHash('sha256');
        hash.update(secret);
        const key = hash.digest().slice(0, 32);
        const iv = crypto_1.default.randomBytes(16);
        const cipher = crypto_1.default.createCipheriv('aes-256-cbc', key, iv);
        let encrypted = cipher.update(data);
        encrypted = Buffer.concat([encrypted, cipher.final()]);
        return { iv: iv.toString('hex'), data: encrypted.toString('hex') };
    }
    /**
     * @description Decrypts data.
     * @param {String} data - Data to be decrypted
     * @param {String} _iv - Encryption iv
     * @param {String} secret - Secret used in the encryption
     */
    async Decrypt(data, _iv, secret) {
        const hash = crypto_1.default.createHash('sha256');
        hash.update(secret);
        const key = hash.digest().slice(0, 32);
        const iv = Buffer.from(_iv, 'hex');
        const encryptedText = Buffer.from(data, 'hex');
        const decipher = crypto_1.default.createDecipheriv('aes-256-cbc', Buffer.from(key), iv);
        let decrypted = decipher.update(encryptedText);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        return decrypted.toString();
    }
}
_Database_dbUrl = new WeakMap(), _Database_dbConnection = new WeakMap(), _Database_deploy = new WeakMap();
module.exports = Database;
//# sourceMappingURL=Database.js.map