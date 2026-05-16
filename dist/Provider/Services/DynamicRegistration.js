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
var _DynamicRegistration_instances, _DynamicRegistration_name, _DynamicRegistration_redirectUris, _DynamicRegistration_customParameters, _DynamicRegistration_autoActivate, _DynamicRegistration_useDeepLinking, _DynamicRegistration_logo, _DynamicRegistration_description, _DynamicRegistration_hostname, _DynamicRegistration_appUrl, _DynamicRegistration_loginUrl, _DynamicRegistration_keysetUrl, _DynamicRegistration_getPlatform, _DynamicRegistration_registerPlatform, _DynamicRegistration_ENCRYPTIONKEY, _DynamicRegistration_Database, _DynamicRegistration_buildUrl, _DynamicRegistration_getHostname;
/* Provider Dynamic Registration Service */
const Http_1 = __importDefault(require("../../Utils/Http"));
const crypto_1 = __importDefault(require("crypto"));
const fast_url_parser_1 = __importDefault(require("fast-url-parser"));
const debug_1 = __importDefault(require("debug"));
const Objects_1 = __importDefault(require("../../Utils/Objects"));
const provDynamicRegistrationDebug = (0, debug_1.default)('provider:dynamicRegistrationService');
class DynamicRegistration {
    constructor(options, routes, registerPlatform, getPlatform, ENCRYPTIONKEY, Database) {
        _DynamicRegistration_instances.add(this);
        _DynamicRegistration_name.set(this, void 0);
        _DynamicRegistration_redirectUris.set(this, void 0);
        _DynamicRegistration_customParameters.set(this, void 0);
        _DynamicRegistration_autoActivate.set(this, void 0);
        _DynamicRegistration_useDeepLinking.set(this, void 0);
        _DynamicRegistration_logo.set(this, void 0);
        _DynamicRegistration_description.set(this, void 0);
        _DynamicRegistration_hostname.set(this, void 0);
        _DynamicRegistration_appUrl.set(this, void 0);
        _DynamicRegistration_loginUrl.set(this, void 0);
        _DynamicRegistration_keysetUrl.set(this, void 0);
        _DynamicRegistration_getPlatform.set(this, void 0);
        _DynamicRegistration_registerPlatform.set(this, void 0);
        _DynamicRegistration_ENCRYPTIONKEY.set(this, '');
        _DynamicRegistration_Database.set(this, void 0);
        __classPrivateFieldSet(this, _DynamicRegistration_name, options.name, "f");
        __classPrivateFieldSet(this, _DynamicRegistration_redirectUris, options.redirectUris || [], "f");
        __classPrivateFieldSet(this, _DynamicRegistration_customParameters, options.customParameters || {}, "f");
        __classPrivateFieldSet(this, _DynamicRegistration_autoActivate, !!options.autoActivate, "f");
        __classPrivateFieldSet(this, _DynamicRegistration_useDeepLinking, options.useDeepLinking === undefined ? true : options.useDeepLinking, "f");
        __classPrivateFieldSet(this, _DynamicRegistration_logo, options.logo, "f");
        __classPrivateFieldSet(this, _DynamicRegistration_description, options.description, "f");
        __classPrivateFieldSet(this, _DynamicRegistration_hostname, __classPrivateFieldGet(this, _DynamicRegistration_instances, "m", _DynamicRegistration_getHostname).call(this, options.url), "f");
        __classPrivateFieldSet(this, _DynamicRegistration_appUrl, __classPrivateFieldGet(this, _DynamicRegistration_instances, "m", _DynamicRegistration_buildUrl).call(this, options.url, routes.appRoute), "f");
        __classPrivateFieldSet(this, _DynamicRegistration_loginUrl, __classPrivateFieldGet(this, _DynamicRegistration_instances, "m", _DynamicRegistration_buildUrl).call(this, options.url, routes.loginRoute), "f");
        __classPrivateFieldSet(this, _DynamicRegistration_keysetUrl, __classPrivateFieldGet(this, _DynamicRegistration_instances, "m", _DynamicRegistration_buildUrl).call(this, options.url, routes.keysetRoute), "f");
        __classPrivateFieldSet(this, _DynamicRegistration_getPlatform, getPlatform, "f");
        __classPrivateFieldSet(this, _DynamicRegistration_registerPlatform, registerPlatform, "f");
        __classPrivateFieldSet(this, _DynamicRegistration_ENCRYPTIONKEY, ENCRYPTIONKEY, "f");
        __classPrivateFieldSet(this, _DynamicRegistration_Database, Database, "f");
    }
    /**
     * @description Performs dynamic registration flow.
     */
    async register(openidConfiguration, registrationToken, options = {}) {
        if (!openidConfiguration)
            throw new Error('MISSING_OPENID_CONFIGURATION');
        provDynamicRegistrationDebug('Starting dynamic registration process');
        // Get Platform registration configurations
        const configuration = await Http_1.default.get(openidConfiguration).json();
        provDynamicRegistrationDebug('Attempting to register Platform with issuer: ', configuration.issuer);
        // Building registration object
        const messages = [{ type: 'LtiResourceLinkRequest' }];
        if (__classPrivateFieldGet(this, _DynamicRegistration_useDeepLinking, "f"))
            messages.push({ type: 'LtiDeepLinkingRequest' });
        const registration = Objects_1.default.deepMergeObjects({
            application_type: 'web',
            response_types: ['id_token'],
            grant_types: ['implicit', 'client_credentials'],
            initiate_login_uri: __classPrivateFieldGet(this, _DynamicRegistration_loginUrl, "f"),
            redirect_uris: [...__classPrivateFieldGet(this, _DynamicRegistration_redirectUris, "f"), __classPrivateFieldGet(this, _DynamicRegistration_appUrl, "f")],
            client_name: __classPrivateFieldGet(this, _DynamicRegistration_name, "f"),
            jwks_uri: __classPrivateFieldGet(this, _DynamicRegistration_keysetUrl, "f"),
            logo_uri: __classPrivateFieldGet(this, _DynamicRegistration_logo, "f"),
            token_endpoint_auth_method: 'private_key_jwt',
            scope: 'https://purl.imsglobal.org/spec/lti-ags/scope/lineitem.readonly https://purl.imsglobal.org/spec/lti-ags/scope/lineitem https://purl.imsglobal.org/spec/lti-ags/scope/score https://purl.imsglobal.org/spec/lti-ags/scope/result.readonly https://purl.imsglobal.org/spec/lti-nrps/scope/contextmembership.readonly',
            'https://purl.imsglobal.org/spec/lti-tool-configuration': {
                domain: __classPrivateFieldGet(this, _DynamicRegistration_hostname, "f"),
                description: __classPrivateFieldGet(this, _DynamicRegistration_description, "f"),
                target_link_uri: __classPrivateFieldGet(this, _DynamicRegistration_appUrl, "f"),
                custom_parameters: __classPrivateFieldGet(this, _DynamicRegistration_customParameters, "f"),
                claims: configuration.claims_supported,
                messages
            }
        }, options);
        provDynamicRegistrationDebug('Tool registration request:');
        provDynamicRegistrationDebug(registration);
        provDynamicRegistrationDebug('Sending Tool registration request');
        const registrationResponse = await Http_1.default.post(configuration.registration_endpoint, { json: registration, headers: registrationToken ? { Authorization: 'Bearer ' + registrationToken } : undefined }).json();
        // Registering Platform
        const platformName = (configuration['https://purl.imsglobal.org/spec/lti-platform-configuration'] ? configuration['https://purl.imsglobal.org/spec/lti-platform-configuration'].product_family_code : 'Platform') + '_DynReg_' + crypto_1.default.randomBytes(16).toString('hex');
        if (await __classPrivateFieldGet(this, _DynamicRegistration_getPlatform, "f").call(this, configuration.issuer, registrationResponse.client_id, __classPrivateFieldGet(this, _DynamicRegistration_ENCRYPTIONKEY, "f"), __classPrivateFieldGet(this, _DynamicRegistration_Database, "f")))
            throw new Error('PLATFORM_ALREADY_REGISTERED');
        provDynamicRegistrationDebug('Registering Platform');
        const platform = {
            url: configuration.issuer,
            name: platformName,
            clientId: registrationResponse.client_id,
            authenticationEndpoint: configuration.authorization_endpoint,
            accesstokenEndpoint: configuration.token_endpoint,
            authorizationServer: configuration.authorization_server || configuration.token_endpoint,
            authConfig: {
                method: 'JWK_SET',
                key: configuration.jwks_uri
            }
        };
        const registered = await __classPrivateFieldGet(this, _DynamicRegistration_registerPlatform, "f").call(this, platform, __classPrivateFieldGet(this, _DynamicRegistration_getPlatform, "f"), __classPrivateFieldGet(this, _DynamicRegistration_ENCRYPTIONKEY, "f"), __classPrivateFieldGet(this, _DynamicRegistration_Database, "f"));
        await __classPrivateFieldGet(this, _DynamicRegistration_Database, "f").Insert(false, 'platformStatus', { id: await registered.platformId(), active: __classPrivateFieldGet(this, _DynamicRegistration_autoActivate, "f") });
        // Returing message indicating the end of registration flow
        return '<script>(window.opener || window.parent).postMessage({subject:"org.imsglobal.lti.close"}, "*");</script>';
    }
}
_DynamicRegistration_name = new WeakMap(), _DynamicRegistration_redirectUris = new WeakMap(), _DynamicRegistration_customParameters = new WeakMap(), _DynamicRegistration_autoActivate = new WeakMap(), _DynamicRegistration_useDeepLinking = new WeakMap(), _DynamicRegistration_logo = new WeakMap(), _DynamicRegistration_description = new WeakMap(), _DynamicRegistration_hostname = new WeakMap(), _DynamicRegistration_appUrl = new WeakMap(), _DynamicRegistration_loginUrl = new WeakMap(), _DynamicRegistration_keysetUrl = new WeakMap(), _DynamicRegistration_getPlatform = new WeakMap(), _DynamicRegistration_registerPlatform = new WeakMap(), _DynamicRegistration_ENCRYPTIONKEY = new WeakMap(), _DynamicRegistration_Database = new WeakMap(), _DynamicRegistration_instances = new WeakSet(), _DynamicRegistration_buildUrl = function _DynamicRegistration_buildUrl(url, path) {
    if (path === '/')
        return url;
    const pathParts = fast_url_parser_1.default.parse(url);
    const portMatch = pathParts.pathname.match(/:[0-9]*/);
    if (portMatch) {
        pathParts.port = portMatch[0].split(':')[1];
        pathParts.pathname = pathParts.pathname.split(portMatch[0]).join('');
    }
    const formattedUrl = fast_url_parser_1.default.format({
        protocol: pathParts.protocol,
        hostname: pathParts.hostname,
        pathname: (pathParts.pathname + path).replace('//', '/'),
        port: pathParts.port,
        auth: pathParts.auth,
        hash: pathParts.hash,
        search: pathParts.search
    });
    return formattedUrl;
}, _DynamicRegistration_getHostname = function _DynamicRegistration_getHostname(url) {
    const pathParts = fast_url_parser_1.default.parse(url);
    let hostname = pathParts.hostname;
    if (pathParts.port)
        hostname += ':' + pathParts.port;
    return hostname;
};
module.exports = DynamicRegistration;
//# sourceMappingURL=DynamicRegistration.js.map