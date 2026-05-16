"use strict";
/* Names and Roles Provisioning Service */
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
var _NamesAndRoles_getPlatform, _NamesAndRoles_ENCRYPTIONKEY, _NamesAndRoles_Database;
const Http_1 = __importDefault(require("../../Utils/Http"));
const parse_link_header_1 = __importDefault(require("parse-link-header"));
const debug_1 = __importDefault(require("debug"));
const provNamesAndRolesServiceDebug = (0, debug_1.default)('provider:namesAndRolesService');
class NamesAndRoles {
    constructor(getPlatform, ENCRYPTIONKEY, Database) {
        _NamesAndRoles_getPlatform.set(this, void 0);
        _NamesAndRoles_ENCRYPTIONKEY.set(this, '');
        _NamesAndRoles_Database.set(this, void 0);
        __classPrivateFieldSet(this, _NamesAndRoles_getPlatform, getPlatform, "f");
        __classPrivateFieldSet(this, _NamesAndRoles_ENCRYPTIONKEY, ENCRYPTIONKEY, "f");
        __classPrivateFieldSet(this, _NamesAndRoles_Database, Database, "f");
    }
    /**
     * @description Retrieves members from platform.
     */
    async getMembers(idtoken, options) {
        if (!idtoken) {
            provNamesAndRolesServiceDebug('Missing IdToken object.');
            throw new Error('MISSING_ID_TOKEN');
        }
        provNamesAndRolesServiceDebug('Attempting to retrieve memberships');
        provNamesAndRolesServiceDebug('Target platform: ' + idtoken.iss);
        const platform = await __classPrivateFieldGet(this, _NamesAndRoles_getPlatform, "f").call(this, idtoken.iss, idtoken.clientId, __classPrivateFieldGet(this, _NamesAndRoles_ENCRYPTIONKEY, "f"), __classPrivateFieldGet(this, _NamesAndRoles_Database, "f"));
        if (!platform) {
            provNamesAndRolesServiceDebug('Platform not found');
            throw new Error('PLATFORM_NOT_FOUND');
        }
        const platformActive = await platform.platformActive();
        if (!platformActive)
            throw new Error('PLATFORM_NOT_ACTIVATED');
        provNamesAndRolesServiceDebug('Attempting to retrieve platform access_token for [' + idtoken.iss + ']');
        const tokenRes = await platform.platformAccessToken('https://purl.imsglobal.org/spec/lti-nrps/scope/contextmembership.readonly');
        provNamesAndRolesServiceDebug('Access_token retrieved for [' + idtoken.iss + ']');
        let pages = 1; // Page limit
        let queryArr = [];
        let next = idtoken.platformContext.namesRoles.context_memberships_url;
        if (options) {
            if (options.pages || options.pages === false) {
                provNamesAndRolesServiceDebug('Maximum number of pages retrieved: ' + options.pages);
                pages = options.pages;
            }
            if (options.url) {
                next = options.url;
                queryArr = false;
            }
            else {
                if (options.role) {
                    provNamesAndRolesServiceDebug('Adding role parameter with value: ' + options.role);
                    queryArr.push(['role', options.role]);
                }
                if (options.limit) {
                    provNamesAndRolesServiceDebug('Adding limit parameter with value: ' + options.limit);
                    queryArr.push(['limit', String(options.limit)]);
                }
                if (options.resourceLinkId) {
                    provNamesAndRolesServiceDebug('Adding rlid parameter with value: ' + idtoken.platformContext.resource.id);
                    queryArr.push(['rlid', idtoken.platformContext.resource.id]);
                }
            }
        }
        let query;
        if (queryArr && queryArr.length > 0)
            query = new URLSearchParams(queryArr);
        else
            query = false;
        let differences;
        let result;
        let curPage = 1;
        do {
            if (pages && curPage > pages) {
                if (next)
                    result.next = next;
                break;
            }
            let response;
            provNamesAndRolesServiceDebug('Member pages found: ', curPage);
            provNamesAndRolesServiceDebug('Current member page: ', next);
            if (query && curPage === 1)
                response = await Http_1.default.get(next, { searchParams: query, headers: { Authorization: tokenRes.token_type + ' ' + tokenRes.access_token, Accept: 'application/vnd.ims.lti-nrps.v2.membershipcontainer+json' } });
            else
                response = await Http_1.default.get(next, { headers: { Authorization: tokenRes.token_type + ' ' + tokenRes.access_token, Accept: 'application/vnd.ims.lti-nrps.v2.membershipcontainer+json' } });
            const headers = response.headers;
            const body = JSON.parse(response.body);
            if (!result)
                result = JSON.parse(JSON.stringify(body));
            else {
                result.members = [
                    ...result.members,
                    ...body.members
                ];
            }
            const parsedLinks = (0, parse_link_header_1.default)(headers.link);
            // Trying to find "rel=differences" header
            if (parsedLinks && parsedLinks.differences)
                differences = parsedLinks.differences.url;
            // Trying to find "rel=next" header, indicating additional pages
            if (parsedLinks && parsedLinks.next)
                next = parsedLinks.next.url;
            else
                next = false;
            curPage++;
        } while (next);
        if (differences)
            result.differences = differences;
        provNamesAndRolesServiceDebug('Memberships retrieved');
        return result;
    }
}
_NamesAndRoles_getPlatform = new WeakMap(), _NamesAndRoles_ENCRYPTIONKEY = new WeakMap(), _NamesAndRoles_Database = new WeakMap();
module.exports = NamesAndRoles;
//# sourceMappingURL=NamesAndRoles.js.map