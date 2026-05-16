"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
const got_1 = __importDefault(require("got"));
const package_json_1 = __importDefault(require("../../package.json"));
/**
 * @description Configures a default HTTP client User-Agent.
 */
const httpClient = got_1.default.extend({
    headers: {
        'User-Agent': `ltijs/${package_json_1.default.version}`
    }
});
module.exports = httpClient;
//# sourceMappingURL=Http.js.map