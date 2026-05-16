"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
/* Handle jwk keyset generation */
const rasha_1 = __importDefault(require("rasha"));
const debug_1 = __importDefault(require("debug"));
const provKeysetDebug = (0, debug_1.default)('provider:keyset');
class Keyset {
    /**
     * @description Handles the creation of jwk keyset.
     */
    static async build(Database, ENCRYPTIONKEY) {
        provKeysetDebug('Generating JWK keyset');
        const keys = (await Database.Get(ENCRYPTIONKEY, 'publickey')) || [];
        const keyset = { keys: [] };
        for (const key of keys) {
            const jwk = await rasha_1.default.import({ pem: key.key });
            jwk.kid = key.kid;
            jwk.alg = 'RS256';
            jwk.use = 'sig';
            keyset.keys.push(jwk);
        }
        return keyset;
    }
}
module.exports = Keyset;
//# sourceMappingURL=Keyset.js.map