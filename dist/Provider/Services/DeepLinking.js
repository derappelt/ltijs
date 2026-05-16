"use strict";
/* Provider Deep Linking Service */
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
var _DeepLinking_getPlatform, _DeepLinking_ENCRYPTIONKEY, _DeepLinking_Database;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const path_1 = __importDefault(require("path"));
const debug_1 = __importDefault(require("debug"));
const sprightly_1 = require("sprightly");
const provDeepLinkingDebug = (0, debug_1.default)('provider:deepLinkingService');
// Templates live at dist/Templates/ but this compiled file lives at dist/Provider/Services/,
// so we need to walk up two levels.
const deepLinkSubmissionForm = path_1.default.join(__dirname, '..', '..', 'Templates', 'DeepLinkSubmissionForm.html');
class DeepLinking {
    constructor(getPlatform, ENCRYPTIONKEY, Database) {
        _DeepLinking_getPlatform.set(this, void 0);
        _DeepLinking_ENCRYPTIONKEY.set(this, '');
        _DeepLinking_Database.set(this, void 0);
        __classPrivateFieldSet(this, _DeepLinking_getPlatform, getPlatform, "f");
        __classPrivateFieldSet(this, _DeepLinking_ENCRYPTIONKEY, ENCRYPTIONKEY, "f");
        __classPrivateFieldSet(this, _DeepLinking_Database, Database, "f");
    }
    /**
     * @description Creates an auto submitting form containing the DeepLinking Message.
     */
    async createDeepLinkingForm(idtoken, contentItems, options) {
        const message = await this.createDeepLinkingMessage(idtoken, contentItems, options);
        // Creating auto submitting form
        const form = (0, sprightly_1.sprightly)(deepLinkSubmissionForm, { action: idtoken.platformContext.deepLinkingSettings.deep_link_return_url, message });
        return form;
    }
    /**
     * @description Creates a DeepLinking signed message.
     */
    async createDeepLinkingMessage(idtoken, contentItems, options) {
        provDeepLinkingDebug('Starting deep linking process');
        if (!idtoken) {
            provDeepLinkingDebug('Missing IdToken object.');
            throw new Error('MISSING_ID_TOKEN');
        }
        if (!idtoken.platformContext.deepLinkingSettings) {
            provDeepLinkingDebug('DeepLinkingSettings object missing.');
            throw new Error('MISSING_DEEP_LINK_SETTINGS');
        }
        if (!contentItems) {
            provDeepLinkingDebug('No content item passed.');
            throw new Error('MISSING_CONTENT_ITEMS');
        }
        // If it's not an array, turns it into an array
        if (!Array.isArray(contentItems))
            contentItems = [contentItems];
        // Gets platform
        const platform = await __classPrivateFieldGet(this, _DeepLinking_getPlatform, "f").call(this, idtoken.iss, idtoken.clientId, __classPrivateFieldGet(this, _DeepLinking_ENCRYPTIONKEY, "f"), __classPrivateFieldGet(this, _DeepLinking_Database, "f"));
        if (!platform) {
            provDeepLinkingDebug('Platform not found');
            throw new Error('PLATFORM_NOT_FOUND');
        }
        const platformActive = await platform.platformActive();
        if (!platformActive)
            throw new Error('PLATFORM_NOT_ACTIVATED');
        provDeepLinkingDebug('Building basic JWT body');
        // Builds basic jwt body
        const jwtBody = {
            iss: await platform.platformClientId(),
            aud: idtoken.iss,
            nonce: encodeURIComponent([...Array(25)].map(_ => (Math.random() * 36 | 0).toString(36)).join('')),
            'https://purl.imsglobal.org/spec/lti/claim/deployment_id': idtoken.deploymentId,
            'https://purl.imsglobal.org/spec/lti/claim/message_type': 'LtiDeepLinkingResponse',
            'https://purl.imsglobal.org/spec/lti/claim/version': '1.3.0'
        };
        // Adding messaging options
        if (options) {
            if (options.message)
                jwtBody['https://purl.imsglobal.org/spec/lti-dl/claim/msg'] = options.message;
            if (options.errMessage || options.errmessage)
                jwtBody['https://purl.imsglobal.org/spec/lti-dl/claim/errormsg '] = options.errMessage || options.errmessage;
            if (options.log)
                jwtBody['https://purl.imsglobal.org/spec/lti-dl/claim/log'] = options.log;
            if (options.errLog || options.errlog)
                jwtBody['https://purl.imsglobal.org/spec/lti-dl/claim/errorlog'] = options.errLog || options.errlog;
        }
        // Adding Data claim if it exists in initial request
        if (idtoken.platformContext.deepLinkingSettings.data)
            jwtBody['https://purl.imsglobal.org/spec/lti-dl/claim/data'] = idtoken.platformContext.deepLinkingSettings.data;
        provDeepLinkingDebug('Sanitizing content item array based on the platform\'s requirements:');
        const selectedContentItems = [];
        const acceptedTypes = idtoken.platformContext.deepLinkingSettings.accept_types;
        const acceptMultiple = !(idtoken.platformContext.deepLinkingSettings.accept_multiple === 'false' || idtoken.platformContext.deepLinkingSettings.accept_multiple === false);
        provDeepLinkingDebug('Accepted Types: ' + acceptedTypes);
        provDeepLinkingDebug('Accepts Mutiple: ' + acceptMultiple);
        provDeepLinkingDebug('Received content items: ');
        provDeepLinkingDebug(contentItems);
        for (const contentItem of contentItems) {
            if (!acceptedTypes.includes(contentItem.type))
                continue;
            selectedContentItems.push(contentItem);
            if (!acceptMultiple)
                break;
        }
        provDeepLinkingDebug('Content items to be sent: ');
        provDeepLinkingDebug(selectedContentItems);
        jwtBody['https://purl.imsglobal.org/spec/lti-dl/claim/content_items'] = selectedContentItems;
        const message = jsonwebtoken_1.default.sign(jwtBody, await platform.platformPrivateKey(), { algorithm: 'RS256', expiresIn: 60, keyid: await platform.platformKid() });
        return message;
    }
}
_DeepLinking_getPlatform = new WeakMap(), _DeepLinking_ENCRYPTIONKEY = new WeakMap(), _DeepLinking_Database = new WeakMap();
module.exports = DeepLinking;
//# sourceMappingURL=DeepLinking.js.map