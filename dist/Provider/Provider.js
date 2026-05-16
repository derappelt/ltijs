"use strict";
/* eslint-disable require-atomic-updates */
/* eslint-disable no-useless-escape */
var __classPrivateFieldGet = (this && this.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var __classPrivateFieldSet = (this && this.__classPrivateFieldSet) || function (receiver, state, value, kind, f) {
    if (kind === "m") throw new TypeError("Private method is not writable");
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
    return (kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value)), value;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var _Provider_loginRoute, _Provider_appRoute, _Provider_keysetRoute, _Provider_dynRegRoute, _Provider_whitelistedRoutes, _Provider_ENCRYPTIONKEY, _Provider_devMode, _Provider_ltiaas, _Provider_tokenMaxAge, _Provider_cookieOptions, _Provider_setup, _Provider_connectCallback, _Provider_deepLinkingCallback, _Provider_dynamicRegistrationCallback, _Provider_sessionTimeoutCallback, _Provider_invalidTokenCallback, _Provider_unregisteredPlatformCallback, _Provider_inactivePlatformCallback, _Provider_keyset, _Provider_server;
/* Main class for the Provider functionalities */
const Server_1 = __importDefault(require("../Utils/Server"));
const Request_1 = __importDefault(require("../Utils/Request"));
const Platform_1 = __importDefault(require("../Utils/Platform"));
const Auth_1 = __importDefault(require("../Utils/Auth"));
const Database_1 = __importDefault(require("../Utils/Database"));
const Keyset_1 = __importDefault(require("../Utils/Keyset"));
const Grade_1 = __importDefault(require("./Services/Grade"));
const DeepLinking_1 = __importDefault(require("./Services/DeepLinking"));
const NamesAndRoles_1 = __importDefault(require("./Services/NamesAndRoles"));
const DynamicRegistration_1 = __importDefault(require("./Services/DynamicRegistration"));
const fast_url_parser_1 = __importDefault(require("fast-url-parser"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const crypto_1 = __importDefault(require("crypto"));
const debug_1 = __importDefault(require("debug"));
const provAuthDebug = (0, debug_1.default)('provider:auth');
const provMainDebug = (0, debug_1.default)('provider:main');
const provDynamicRegistrationDebug = (0, debug_1.default)('provider:dynamicRegistrationService');
/**
 * @descripttion LTI Provider Class that implements the LTI 1.3 protocol and services.
 */
class Provider {
    constructor() {
        // Pre-initiated variables
        _Provider_loginRoute.set(this, '/login');
        _Provider_appRoute.set(this, '/');
        _Provider_keysetRoute.set(this, '/keys');
        _Provider_dynRegRoute.set(this, '/register');
        _Provider_whitelistedRoutes.set(this, []);
        _Provider_ENCRYPTIONKEY.set(this, void 0);
        _Provider_devMode.set(this, false);
        _Provider_ltiaas.set(this, false);
        _Provider_tokenMaxAge.set(this, 10);
        _Provider_cookieOptions.set(this, {
            secure: false,
            httpOnly: true,
            signed: true
        }
        // Setup flag
        );
        // Setup flag
        _Provider_setup.set(this, false);
        _Provider_connectCallback.set(this, async (token, req, res, next) => { return next(); });
        _Provider_deepLinkingCallback.set(this, async (token, req, res, next) => { return next(); });
        _Provider_dynamicRegistrationCallback.set(this, async (req, res, next) => {
            try {
                if (!req.query.openid_configuration)
                    return res.status(400).send({ status: 400, error: 'Bad Request', details: { message: 'Missing parameter: "openid_configuration".' } });
                const message = await this.DynamicRegistration.register(req.query.openid_configuration, req.query.registration_token);
                res.setHeader('Content-type', 'text/html');
                res.send(message);
            }
            catch (err) {
                provDynamicRegistrationDebug(err);
                if (err.message === 'PLATFORM_ALREADY_REGISTERED')
                    return res.status(403).send({ status: 403, error: 'Forbidden', details: { message: 'Platform already registered.' } });
                return res.status(500).send({ status: 500, error: 'Internal Server Error', details: { message: err.message } });
            }
        });
        _Provider_sessionTimeoutCallback.set(this, async (req, res) => {
            return res.status(401).send(res.locals.err);
        });
        _Provider_invalidTokenCallback.set(this, async (req, res) => {
            return res.status(401).send(res.locals.err);
        });
        _Provider_unregisteredPlatformCallback.set(this, async (req, res) => {
            return res.status(400).send({ status: 400, error: 'Bad Request', details: { message: 'UNREGISTERED_PLATFORM' } });
        });
        _Provider_inactivePlatformCallback.set(this, async (req, res) => {
            return res.status(401).send({ status: 401, error: 'Unauthorized', details: { message: 'PLATFORM_NOT_ACTIVATED' } });
        }
        // Assembles and sends keyset
        );
        // Assembles and sends keyset
        _Provider_keyset.set(this, async (req, res) => {
            try {
                const keyset = await Keyset_1.default.build(this.Database, __classPrivateFieldGet(this, _Provider_ENCRYPTIONKEY, "f"));
                return res.status(200).send(keyset);
            }
            catch (err) {
                provMainDebug(err);
                return res.status(500).send({ status: 500, error: 'Internal Server Error', details: { message: err.message } });
            }
        });
        _Provider_server.set(this, void 0);
    }
    /**
     * @description Provider configuration method.
     */
    setup(encryptionkey, database, options) {
        if (__classPrivateFieldGet(this, _Provider_setup, "f"))
            throw new Error('PROVIDER_ALREADY_SETUP');
        if (options && options.https && (!options.ssl || !options.ssl.key || !options.ssl.cert))
            throw new Error('MISSING_SSL_KEY_CERTIFICATE');
        if (!encryptionkey)
            throw new Error('MISSING_ENCRYPTION_KEY');
        if (!database)
            throw new Error('MISSING_DATABASE_CONFIGURATION');
        if (options && options.dynReg && (!options.dynReg.url || !options.dynReg.name))
            throw new Error('MISSING_DYNREG_CONFIGURATION');
        /**
         * @description Database object.
         */
        if (!database.plugin)
            this.Database = new Database_1.default(database);
        else
            this.Database = database.plugin;
        if (options && (options.appRoute || options.appUrl))
            __classPrivateFieldSet(this, _Provider_appRoute, (options.appRoute || options.appUrl), "f");
        if (options && (options.loginRoute || options.loginUrl))
            __classPrivateFieldSet(this, _Provider_loginRoute, (options.loginRoute || options.loginUrl), "f");
        if (options && (options.keysetRoute || options.keysetUrl))
            __classPrivateFieldSet(this, _Provider_keysetRoute, (options.keysetRoute || options.keysetUrl), "f");
        if (options && options.dynRegRoute)
            __classPrivateFieldSet(this, _Provider_dynRegRoute, options.dynRegRoute, "f");
        if (options && options.devMode === true)
            __classPrivateFieldSet(this, _Provider_devMode, true, "f");
        if (options && options.ltiaas === true)
            __classPrivateFieldSet(this, _Provider_ltiaas, true, "f");
        if (options && options.tokenMaxAge !== undefined)
            __classPrivateFieldSet(this, _Provider_tokenMaxAge, options.tokenMaxAge, "f");
        // Cookie options
        if (options && options.cookies) {
            if (options.cookies.secure === true)
                __classPrivateFieldGet(this, _Provider_cookieOptions, "f").secure = true;
            if (options.cookies.sameSite)
                __classPrivateFieldGet(this, _Provider_cookieOptions, "f").sameSite = options.cookies.sameSite;
            if (options.cookies.domain)
                __classPrivateFieldGet(this, _Provider_cookieOptions, "f").domain = options.cookies.domain;
        }
        __classPrivateFieldSet(this, _Provider_ENCRYPTIONKEY, encryptionkey, "f");
        __classPrivateFieldSet(this, _Provider_server, new Server_1.default(options ? options.https : false, options && options.ssl ? options.ssl : false, __classPrivateFieldGet(this, _Provider_ENCRYPTIONKEY, "f"), options ? options.cors : true, options ? options.serverAddon : undefined), "f");
        /**
         * @description Express server object.
         */
        this.app = __classPrivateFieldGet(this, _Provider_server, "f").app;
        /**
         * @description Grading service.
         */
        this.Grade = new Grade_1.default(this.getPlatform.bind(this), __classPrivateFieldGet(this, _Provider_ENCRYPTIONKEY, "f"), this.Database);
        /**
         * @description Deep Linking service.
         */
        this.DeepLinking = new DeepLinking_1.default(this.getPlatform.bind(this), __classPrivateFieldGet(this, _Provider_ENCRYPTIONKEY, "f"), this.Database);
        /**
         * @description Names and Roles service.
         */
        this.NamesAndRoles = new NamesAndRoles_1.default(this.getPlatform.bind(this), __classPrivateFieldGet(this, _Provider_ENCRYPTIONKEY, "f"), this.Database);
        if (options && options.dynReg) {
            const routes = {
                appRoute: __classPrivateFieldGet(this, _Provider_appRoute, "f"),
                loginRoute: __classPrivateFieldGet(this, _Provider_loginRoute, "f"),
                keysetRoute: __classPrivateFieldGet(this, _Provider_keysetRoute, "f")
            };
            /**
             * @description Dynamic Registration service.
             */
            this.DynamicRegistration = new DynamicRegistration_1.default(options.dynReg, routes, this.registerPlatform.bind(this), this.getPlatform.bind(this), __classPrivateFieldGet(this, _Provider_ENCRYPTIONKEY, "f"), this.Database);
        }
        if (options && options.staticPath)
            __classPrivateFieldGet(this, _Provider_server, "f").setStaticPath(options.staticPath);
        // Registers main athentication and routing middleware
        const sessionValidator = async (req, res, next) => {
            provMainDebug('Receiving request at path: ' + req.baseUrl + req.path);
            // Ckeck if request is attempting to initiate oidc login flow or access reserved routes
            if (req.path === __classPrivateFieldGet(this, _Provider_loginRoute, "f") || req.path === __classPrivateFieldGet(this, _Provider_keysetRoute, "f") || req.path === __classPrivateFieldGet(this, _Provider_dynRegRoute, "f"))
                return next();
            provMainDebug('Path does not match reserved endpoints');
            try {
                // Retrieving ltik token
                const ltik = req.token;
                // Retrieving cookies
                const cookies = req.signedCookies;
                provMainDebug('Cookies received: ');
                provMainDebug(cookies);
                if (!ltik) {
                    const idtoken = req.body.id_token;
                    if (idtoken) {
                        // No ltik found but request contains an idtoken
                        provMainDebug('Received idtoken for validation');
                        // Retrieves state
                        const state = req.body.state;
                        // Retrieving validation parameters from cookies
                        provAuthDebug('Response state: ' + state);
                        const validationCookie = cookies['state' + state];
                        const validationParameters = {
                            iss: validationCookie,
                            maxAge: __classPrivateFieldGet(this, _Provider_tokenMaxAge, "f")
                        };
                        const valid = await Auth_1.default.validateToken(idtoken, __classPrivateFieldGet(this, _Provider_devMode, "f"), validationParameters, this.getPlatform.bind(this), __classPrivateFieldGet(this, _Provider_ENCRYPTIONKEY, "f"), this.Database);
                        // Retrieve State object from Database
                        const savedState = await this.Database.Get(false, 'state', { state });
                        // Deletes state validation cookie and Database entry
                        res.clearCookie('state' + state, __classPrivateFieldGet(this, _Provider_cookieOptions, "f"));
                        if (savedState)
                            this.Database.Delete('state', { state });
                        provAuthDebug('Successfully validated token!');
                        const courseId = valid['https://purl.imsglobal.org/spec/lti/claim/context'] ? valid['https://purl.imsglobal.org/spec/lti/claim/context'].id : 'NF';
                        const resourceId = valid['https://purl.imsglobal.org/spec/lti/claim/resource_link'] ? valid['https://purl.imsglobal.org/spec/lti/claim/resource_link'].id : 'NF';
                        const clientId = valid.clientId;
                        const deploymentId = valid['https://purl.imsglobal.org/spec/lti/claim/deployment_id'];
                        const additionalContextProperties = {
                            path: req.path,
                            roles: valid['https://purl.imsglobal.org/spec/lti/claim/roles'],
                            targetLinkUri: valid['https://purl.imsglobal.org/spec/lti/claim/target_link_uri'],
                            custom: valid['https://purl.imsglobal.org/spec/lti/claim/custom'],
                            launchPresentation: valid['https://purl.imsglobal.org/spec/lti/claim/launch_presentation'],
                            endpoint: valid['https://purl.imsglobal.org/spec/lti-ags/claim/endpoint'],
                            namesRoles: valid['https://purl.imsglobal.org/spec/lti-nrps/claim/namesroleservice']
                        };
                        const hashOfAdditionalContextProperties = crypto_1.default.createHash('sha256').update(JSON.stringify(additionalContextProperties)).digest('hex');
                        // Appending hashOfContextProperties is a temporary fix to prevent overwriting existing database entries in some scenarios. See: https://github.com/Cvmcosta/ltijs/issues/181
                        const contextId = encodeURIComponent(valid.iss + clientId + deploymentId + courseId + '_' + resourceId + '_' + hashOfAdditionalContextProperties);
                        const platformCode = encodeURIComponent('lti' + Buffer.from(valid.iss + clientId + deploymentId).toString('base64'));
                        // Mount platform token
                        const platformToken = {
                            iss: valid.iss,
                            user: valid.sub,
                            userInfo: {
                                given_name: valid.given_name,
                                family_name: valid.family_name,
                                name: valid.name,
                                email: valid.email
                            },
                            platformInfo: valid['https://purl.imsglobal.org/spec/lti/claim/tool_platform'],
                            clientId: valid.clientId,
                            platformId: valid.platformId,
                            deploymentId: valid['https://purl.imsglobal.org/spec/lti/claim/deployment_id']
                        };
                        // Store idToken in database
                        await this.Database.Replace(false, 'idtoken', { iss: valid.iss, clientId, deploymentId, user: valid.sub }, platformToken);
                        // Mount context token
                        const contextToken = {
                            contextId,
                            user: valid.sub,
                            context: valid['https://purl.imsglobal.org/spec/lti/claim/context'],
                            resource: valid['https://purl.imsglobal.org/spec/lti/claim/resource_link'],
                            messageType: valid['https://purl.imsglobal.org/spec/lti/claim/message_type'],
                            version: valid['https://purl.imsglobal.org/spec/lti/claim/version'],
                            deepLinkingSettings: valid['https://purl.imsglobal.org/spec/lti-dl/claim/deep_linking_settings'],
                            lis: valid['https://purl.imsglobal.org/spec/lti/claim/lis'],
                            ...additionalContextProperties
                        };
                        // Store contextToken in database
                        await this.Database.Replace(false, 'contexttoken', { contextId, user: valid.sub }, contextToken);
                        // Creates platform session cookie
                        if (!__classPrivateFieldGet(this, _Provider_ltiaas, "f"))
                            res.cookie(platformCode, valid.sub, __classPrivateFieldGet(this, _Provider_cookieOptions, "f"));
                        provMainDebug('Generating ltik');
                        const newLtikObj = {
                            platformUrl: valid.iss,
                            clientId,
                            deploymentId,
                            platformCode,
                            contextId,
                            user: valid.sub,
                            s: state // Added state to make unique ltiks
                        };
                        // Signing context token
                        const newLtik = jsonwebtoken_1.default.sign(newLtikObj, __classPrivateFieldGet(this, _Provider_ENCRYPTIONKEY, "f"));
                        if (__classPrivateFieldGet(this, _Provider_ltiaas, "f")) {
                            // Appending query parameters
                            res.locals.query = {};
                            if (savedState) {
                                for (const [key, value] of Object.entries(savedState[0].query)) {
                                    ;
                                    req.query[key] = value;
                                    res.locals.query[key] = value;
                                }
                            }
                            // Creating local variables
                            res.locals.context = JSON.parse(JSON.stringify(contextToken));
                            res.locals.token = JSON.parse(JSON.stringify(platformToken));
                            res.locals.token.platformContext = res.locals.context;
                            res.locals.ltik = newLtik;
                            provMainDebug('Forwarding request to next handler');
                            return next();
                        }
                        // Appending query parameters
                        const query = new URLSearchParams(req.query);
                        if (savedState) {
                            for (const [key, value] of Object.entries(savedState[0].query)) {
                                query.append(key, value);
                            }
                        }
                        query.append('ltik', newLtik);
                        const urlSearchParams = query.toString();
                        provMainDebug('Redirecting to endpoint with ltik');
                        return res.redirect(req.baseUrl + req.path + '?' + urlSearchParams);
                    }
                    else {
                        const state = req.body.state;
                        if (state) {
                            provMainDebug('Deleting state cookie and Database entry');
                            const savedState = await this.Database.Get(false, 'state', { state });
                            res.clearCookie('state' + state, __classPrivateFieldGet(this, _Provider_cookieOptions, "f"));
                            if (savedState)
                                this.Database.Delete('state', { state });
                        }
                        if (__classPrivateFieldGet(this, _Provider_whitelistedRoutes, "f").find(r => {
                            if ((r.route instanceof RegExp && r.route.test(req.path)) || r.route === req.path)
                                return r.method === 'ALL' || r.method === req.method.toUpperCase();
                            return false;
                        })) {
                            provMainDebug('Accessing as whitelisted route');
                            return next();
                        }
                        provMainDebug('No ltik found');
                        provMainDebug('Request body: ', req.body);
                        provMainDebug('Passing request to invalid token handler');
                        res.locals.err = {
                            status: 401,
                            error: 'Unauthorized',
                            details: {
                                description: 'No Ltik or ID Token found.',
                                message: 'NO_LTIK_OR_IDTOKEN_FOUND',
                                bodyReceived: req.body
                            }
                        };
                        return __classPrivateFieldGet(this, _Provider_invalidTokenCallback, "f").call(this, req, res, next);
                    }
                }
                provMainDebug('Ltik found');
                let validLtik;
                try {
                    validLtik = jsonwebtoken_1.default.verify(ltik, __classPrivateFieldGet(this, _Provider_ENCRYPTIONKEY, "f"));
                }
                catch (err) {
                    if (__classPrivateFieldGet(this, _Provider_whitelistedRoutes, "f").find(r => {
                        if ((r.route instanceof RegExp && r.route.test(req.path)) || r.route === req.path)
                            return r.method === 'ALL' || r.method === req.method.toUpperCase();
                        return false;
                    })) {
                        provMainDebug('Accessing as whitelisted route');
                        return next();
                    }
                    throw (err);
                }
                provMainDebug('Ltik successfully verified');
                const platformUrl = validLtik.platformUrl;
                const platformCode = validLtik.platformCode;
                const clientId = validLtik.clientId;
                const deploymentId = validLtik.deploymentId;
                const contextId = validLtik.contextId;
                let user = validLtik.user;
                if (!__classPrivateFieldGet(this, _Provider_ltiaas, "f")) {
                    provMainDebug('Attempting to retrieve matching session cookie');
                    const cookieUser = cookies[platformCode];
                    if (!cookieUser) {
                        if (!__classPrivateFieldGet(this, _Provider_devMode, "f"))
                            user = false;
                        else {
                            provMainDebug('Dev Mode enabled: Missing session cookies will be ignored');
                        }
                    }
                    else if (user.toString() !== cookieUser.toString())
                        user = false;
                }
                if (user) {
                    provAuthDebug('Valid session found');
                    // Gets corresponding id token from database
                    let idTokenRes = await this.Database.Get(false, 'idtoken', { iss: platformUrl, clientId, deploymentId, user });
                    if (!idTokenRes)
                        throw new Error('IDTOKEN_NOT_FOUND_DB');
                    idTokenRes = idTokenRes[0];
                    const idToken = JSON.parse(JSON.stringify(idTokenRes));
                    // Gets correspondent context token from database
                    let contextToken = await this.Database.Get(false, 'contexttoken', { contextId, user });
                    if (!contextToken)
                        throw new Error('CONTEXTTOKEN_NOT_FOUND_DB');
                    contextToken = contextToken[0];
                    idToken.platformContext = JSON.parse(JSON.stringify(contextToken));
                    // Creating local variables
                    res.locals.context = idToken.platformContext;
                    res.locals.token = idToken;
                    res.locals.ltik = ltik;
                    provMainDebug('Passing request to next handler');
                    return next();
                }
                else {
                    provMainDebug('No session cookie found');
                    provMainDebug('Request body: ', req.body);
                    provMainDebug('Passing request to session timeout handler');
                    res.locals.err = {
                        status: 401,
                        error: 'Unauthorized',
                        details: {
                            message: 'Session not found.'
                        }
                    };
                    return __classPrivateFieldGet(this, _Provider_sessionTimeoutCallback, "f").call(this, req, res, next);
                }
            }
            catch (err) {
                const state = req.body.state;
                if (state) {
                    provMainDebug('Deleting state cookie and Database entry');
                    const savedState = await this.Database.Get(false, 'state', { state });
                    res.clearCookie('state' + state, __classPrivateFieldGet(this, _Provider_cookieOptions, "f"));
                    if (savedState)
                        this.Database.Delete('state', { state });
                }
                provAuthDebug(err);
                provMainDebug('Passing request to invalid token handler');
                res.locals.err = {
                    status: 401,
                    error: 'Unauthorized',
                    details: {
                        description: 'Error validating ltik or IdToken',
                        message: err.message
                    }
                };
                return __classPrivateFieldGet(this, _Provider_invalidTokenCallback, "f").call(this, req, res, next);
            }
        };
        this.app.use(sessionValidator);
        this.app.all(__classPrivateFieldGet(this, _Provider_loginRoute, "f"), async (req, res) => {
            const params = { ...req.query, ...req.body };
            try {
                if (!params.iss || !params.login_hint || !params.target_link_uri)
                    return res.status(400).send({ status: 400, error: 'Bad Request', details: { message: 'MISSING_LOGIN_PARAMETERS' } });
                const iss = params.iss;
                const clientId = params.client_id;
                provMainDebug('Receiving a login request from: ' + iss + ', clientId: ' + clientId);
                let platform;
                if (clientId)
                    platform = await this.getPlatform(iss, clientId);
                else
                    platform = (await this.getPlatform(iss))[0];
                if (platform) {
                    const platformActive = await platform.platformActive();
                    if (!platformActive)
                        return __classPrivateFieldGet(this, _Provider_inactivePlatformCallback, "f").call(this, req, res, () => { });
                    provMainDebug('Redirecting to platform authentication endpoint');
                    // Create state parameter used to validade authentication response
                    let state = encodeURIComponent(crypto_1.default.randomBytes(25).toString('hex'));
                    provMainDebug('Target Link URI: ', params.target_link_uri);
                    /* istanbul ignore next */
                    // Cleaning up target link uri and retrieving query parameters
                    if (params.target_link_uri.includes('?')) {
                        // Retrieve raw queries
                        const rawQueries = new URLSearchParams('?' + params.target_link_uri.split('?')[1]);
                        // Check if state is unique
                        while (await this.Database.Get(false, 'state', { state }))
                            state = encodeURIComponent(crypto_1.default.randomBytes(25).toString('hex'));
                        provMainDebug('Generated state: ', state);
                        // Assemble queries object
                        const queries = {};
                        for (const [key, value] of rawQueries) {
                            queries[key] = value;
                        }
                        params.target_link_uri = params.target_link_uri.split('?')[0];
                        provMainDebug('Query parameters found: ', queries);
                        provMainDebug('Final Redirect URI: ', params.target_link_uri);
                        // Store state and query parameters on database
                        await this.Database.Insert(false, 'state', { state, query: queries });
                    }
                    // Setting up validation info
                    const cookieOptions = JSON.parse(JSON.stringify(__classPrivateFieldGet(this, _Provider_cookieOptions, "f")));
                    cookieOptions.maxAge = 60 * 1000; // Adding max age to state cookie = 1min
                    res.cookie('state' + state, iss, cookieOptions);
                    // Redirect to authentication endpoint
                    const query = await Request_1.default.ltiAdvantageLogin(params, platform, state);
                    provMainDebug('Login request: ');
                    provMainDebug(query);
                    res.redirect(fast_url_parser_1.default.format({
                        pathname: await platform.platformAuthEndpoint(),
                        query: query
                    }));
                }
                else {
                    provMainDebug('Unregistered platform attempting connection: ' + iss + ', clientId: ' + clientId);
                    return __classPrivateFieldGet(this, _Provider_unregisteredPlatformCallback, "f").call(this, req, res, () => { });
                }
            }
            catch (err) {
                provMainDebug(err);
                return res.status(500).send({ status: 500, error: 'Internal Server Error', details: { message: err.message } });
            }
        });
        this.app.get(__classPrivateFieldGet(this, _Provider_keysetRoute, "f"), async (req, res, next) => {
            return __classPrivateFieldGet(this, _Provider_keyset, "f").call(this, req, res, next);
        });
        this.app.all(__classPrivateFieldGet(this, _Provider_dynRegRoute, "f"), async (req, res, next) => {
            if (this.DynamicRegistration)
                return __classPrivateFieldGet(this, _Provider_dynamicRegistrationCallback, "f").call(this, req, res, next);
            return res.status(403).send({ status: 403, error: 'Forbidden', details: { message: 'Dynamic registration is disabled.' } });
        });
        // Main app
        this.app.all(__classPrivateFieldGet(this, _Provider_appRoute, "f"), async (req, res, next) => {
            if (res.locals.context && res.locals.context.messageType === 'LtiDeepLinkingRequest')
                return __classPrivateFieldGet(this, _Provider_deepLinkingCallback, "f").call(this, res.locals.token, req, res, next);
            return __classPrivateFieldGet(this, _Provider_connectCallback, "f").call(this, res.locals.token, req, res, next);
        });
        __classPrivateFieldSet(this, _Provider_setup, true, "f");
        return this;
    }
    /**
     * @description Starts listening to a given port for LTI requests and opens connection to the database.
     */
    async deploy(options) {
        if (!__classPrivateFieldGet(this, _Provider_setup, "f"))
            throw new Error('PROVIDER_NOT_SETUP');
        provMainDebug('Attempting to connect to database');
        try {
            await this.Database.setup();
            const conf = {
                port: 3000,
                silent: false
            };
            if (options && options.port)
                conf.port = options.port;
            if (options && options.silent)
                conf.silent = options.silent;
            // Starts server on given port
            if (options && options.serverless) {
                if (!conf.silent) {
                    console.log('Ltijs started in serverless mode...');
                }
            }
            else {
                await __classPrivateFieldGet(this, _Provider_server, "f").listen(conf.port);
                provMainDebug('Ltijs started listening on port: ', conf.port);
                // Startup message
                const message = 'LTI Provider is listening on port ' + conf.port + '!\n\n LTI provider config: \n >App Route: ' + __classPrivateFieldGet(this, _Provider_appRoute, "f") + '\n >Initiate Login Route: ' + __classPrivateFieldGet(this, _Provider_loginRoute, "f") + '\n >Keyset Route: ' + __classPrivateFieldGet(this, _Provider_keysetRoute, "f") + '\n >Dynamic Registration Route: ' + __classPrivateFieldGet(this, _Provider_dynRegRoute, "f");
                if (!conf.silent) {
                    console.log('  _   _______ _____      _  _____\n' +
                        ' | | |__   __|_   _|    | |/ ____|\n' +
                        ' | |    | |    | |      | | (___  \n' +
                        ' | |    | |    | |  _   | |\\___ \\ \n' +
                        ' | |____| |   _| |_| |__| |____) |\n' +
                        ' |______|_|  |_____|\\____/|_____/ \n\n', message);
                }
            }
            if (__classPrivateFieldGet(this, _Provider_devMode, "f") && !conf.silent)
                console.log('\nStarting in Dev Mode, state validation and session cookies will not be required. THIS SHOULD NOT BE USED IN A PRODUCTION ENVIRONMENT!');
            // Sets up gracefull shutdown
            process.on('SIGINT', async () => {
                await this.close(options);
                process.exit();
            });
            return true;
        }
        catch (err) {
            console.log('Error during deployment: ', err);
            await this.close(options);
            process.exit();
        }
    }
    /**
     * @description Closes connection to database and stops server.
     */
    async close(options) {
        if (!options || options.silent !== true)
            console.log('\nClosing server...');
        await __classPrivateFieldGet(this, _Provider_server, "f").close();
        if (!options || options.silent !== true)
            console.log('Closing connection to the database...');
        await this.Database.Close();
        if (!options || options.silent !== true)
            console.log('Shutdown complete.');
        return true;
    }
    /**
     * @description Sets the callback function called whenever there's a sucessfull lti 1.3 launch, exposing a "token" object containing the idtoken information.
     */
    onConnect(_connectCallback, options) {
        /* istanbul ignore next */
        if (options) {
            if (options.sameSite || options.secure)
                console.log('Deprecation Warning: The optional parameters of the onConnect() method are now deprecated and will be removed in the 6.0 release. Cookie parameters can be found in the main Ltijs constructor options: ... { cookies: { secure: true, sameSite: \'None\' }.');
            if (options.sessionTimeout || options.invalidToken)
                console.log('Deprecation Warning: The optional parameters of the onConnect() method are now deprecated and will be removed in the 6.0 release. Invalid token and Session Timeout methods can now be set with the onSessionTimeout() and onInvalidToken() methods.');
            if (options.sameSite) {
                __classPrivateFieldGet(this, _Provider_cookieOptions, "f").sameSite = options.sameSite;
                if (typeof options.sameSite === 'string' && options.sameSite.toLowerCase() === 'none')
                    __classPrivateFieldGet(this, _Provider_cookieOptions, "f").secure = true;
            }
            if (options.secure === true)
                __classPrivateFieldGet(this, _Provider_cookieOptions, "f").secure = true;
            if (options.sessionTimeout)
                __classPrivateFieldSet(this, _Provider_sessionTimeoutCallback, options.sessionTimeout, "f");
            if (options.invalidToken)
                __classPrivateFieldSet(this, _Provider_invalidTokenCallback, options.invalidToken, "f");
        }
        if (_connectCallback) {
            __classPrivateFieldSet(this, _Provider_connectCallback, _connectCallback, "f");
            return true;
        }
        throw new Error('MISSING_CALLBACK');
    }
    /**
     * @description Sets the callback function called whenever there's a sucessfull deep linking launch.
     */
    onDeepLinking(_deepLinkingCallback) {
        if (_deepLinkingCallback) {
            __classPrivateFieldSet(this, _Provider_deepLinkingCallback, _deepLinkingCallback, "f");
            return true;
        }
        throw new Error('MISSING_CALLBACK');
    }
    /**
     * @description Sets the callback function called whenever there's a sucessfull dynamic registration request.
     */
    onDynamicRegistration(_dynamicRegistrationCallback) {
        if (_dynamicRegistrationCallback) {
            __classPrivateFieldSet(this, _Provider_dynamicRegistrationCallback, _dynamicRegistrationCallback, "f");
            return true;
        }
        throw new Error('MISSING_CALLBACK');
    }
    /**
     * @description Sets the callback function called when no valid session is found during a request validation.
     */
    onSessionTimeout(_sessionTimeoutCallback) {
        if (_sessionTimeoutCallback) {
            __classPrivateFieldSet(this, _Provider_sessionTimeoutCallback, _sessionTimeoutCallback, "f");
            return true;
        }
        throw new Error('MISSING_CALLBACK');
    }
    /**
     * @description Sets the callback function called when the token received fails to be validated.
     */
    onInvalidToken(_invalidTokenCallback) {
        if (_invalidTokenCallback) {
            __classPrivateFieldSet(this, _Provider_invalidTokenCallback, _invalidTokenCallback, "f");
            return true;
        }
        throw new Error('MISSING_CALLBACK');
    }
    /**
     * @description Sets the callback function called when the Platform attempting to login is not registered.
     */
    onUnregisteredPlatform(_unregisteredPlatformCallback) {
        if (_unregisteredPlatformCallback) {
            __classPrivateFieldSet(this, _Provider_unregisteredPlatformCallback, _unregisteredPlatformCallback, "f");
            return true;
        }
        throw new Error('MISSING_CALLBACK');
    }
    /**
     * @description Sets the callback function called when the Platform attempting to login is not activated.
     */
    onInactivePlatform(_inactivePlatformCallback) {
        if (_inactivePlatformCallback) {
            __classPrivateFieldSet(this, _Provider_inactivePlatformCallback, _inactivePlatformCallback, "f");
            return true;
        }
        throw new Error('MISSING_CALLBACK');
    }
    /**
     * @description Gets the main application route that will receive the final decoded Idtoken at the end of a successful launch.
     */
    appRoute() {
        return __classPrivateFieldGet(this, _Provider_appRoute, "f");
    }
    /**
     * @description Gets the login route responsible for dealing with the OIDC login flow.
     */
    loginRoute() {
        return __classPrivateFieldGet(this, _Provider_loginRoute, "f");
    }
    /**
     * @description Gets the keyset route that will be used to retrieve a public jwk keyset.
     */
    keysetRoute() {
        return __classPrivateFieldGet(this, _Provider_keysetRoute, "f");
    }
    /**
     * @description Gets the dynamic registration route that will be used to register platforms dynamically.
     */
    dynRegRoute() {
        return __classPrivateFieldGet(this, _Provider_dynRegRoute, "f");
    }
    /**
     * @description Whitelists routes to bypass the Ltijs authentication protocol.
     */
    whitelist(...routes) {
        if (!routes)
            return __classPrivateFieldGet(this, _Provider_whitelistedRoutes, "f");
        const formattedRoutes = [];
        for (const route of routes) {
            const isObject = (!(route instanceof RegExp) && route === Object(route));
            if (isObject) {
                const r = route;
                if (!r.route || !r.method)
                    throw new Error('WRONG_FORMAT. Details: Expects string ("/route") or object ({ route: "/route", method: "POST" })');
                formattedRoutes.push({ route: r.route, method: r.method.toUpperCase() });
            }
            else
                formattedRoutes.push({ route: route, method: 'ALL' });
        }
        __classPrivateFieldSet(this, _Provider_whitelistedRoutes, [
            ...__classPrivateFieldGet(this, _Provider_whitelistedRoutes, "f"),
            ...formattedRoutes
        ], "f");
        return __classPrivateFieldGet(this, _Provider_whitelistedRoutes, "f");
    }
    /**
     * @description Registers a platform.
     */
    async registerPlatform(platform, getPlatform, ENCRYPTIONKEY, Database) {
        if (!platform || !platform.url || !platform.clientId)
            throw new Error('MISSING_PLATFORM_URL_OR_CLIENTID');
        const _Database = Database || this.Database;
        const _ENCRYPTIONKEY = ENCRYPTIONKEY || __classPrivateFieldGet(this, _Provider_ENCRYPTIONKEY, "f");
        const _getPlatform = getPlatform || this.getPlatform.bind(this);
        let kid;
        const _platform = await _getPlatform(platform.url, platform.clientId, _ENCRYPTIONKEY, _Database);
        if (!_platform) {
            if (!platform.name || !platform.authenticationEndpoint || !platform.accesstokenEndpoint || !platform.authConfig)
                throw new Error('MISSING_PARAMS');
            if (platform.authConfig.method !== 'RSA_KEY' && platform.authConfig.method !== 'JWK_KEY' && platform.authConfig.method !== 'JWK_SET')
                throw new Error('INVALID_AUTHCONFIG_METHOD. Details: Valid methods are "RSA_KEY", "JWK_KEY", "JWK_SET".');
            if (!platform.authConfig.key)
                throw new Error('MISSING_AUTHCONFIG_KEY');
            try {
                kid = await Auth_1.default.generatePlatformKeyPair(_ENCRYPTIONKEY, _Database, platform.url, platform.clientId);
                const plat = new Platform_1.default(platform.name, platform.url, platform.clientId, platform.authenticationEndpoint, platform.accesstokenEndpoint, platform.authorizationServer, kid, _ENCRYPTIONKEY, platform.authConfig, this.Database);
                // Save platform to db
                provMainDebug('Registering new platform');
                provMainDebug('Platform Url: ' + platform.url);
                provMainDebug('Platform ClientId: ' + platform.clientId);
                await _Database.Replace(false, 'platform', { platformUrl: platform.url, clientId: platform.clientId }, { platformName: platform.name, platformUrl: platform.url, clientId: platform.clientId, authEndpoint: platform.authenticationEndpoint, accesstokenEndpoint: platform.accesstokenEndpoint, authorizationServer: platform.authorizationServer, kid, authConfig: platform.authConfig });
                return plat;
            }
            catch (err) {
                await _Database.Delete('publickey', { kid });
                await _Database.Delete('privatekey', { kid });
                await _Database.Delete('platform', { platformUrl: platform.url, clientId: platform.clientId });
                provMainDebug(err.message);
                throw (err);
            }
        }
        else {
            provMainDebug('Platform already registered');
            await _Database.Modify(false, 'platform', { platformUrl: platform.url, clientId: platform.clientId }, { platformName: platform.name || await _platform.platformName(), authEndpoint: platform.authenticationEndpoint || await _platform.platformAuthEndpoint(), accesstokenEndpoint: platform.accesstokenEndpoint || await _platform.platformAccessTokenEndpoint(), authorizationServer: platform.authorizationServer || await _platform.platformAuthorizationServer(), authConfig: platform.authConfig || await _platform.platformAuthConfig() });
            return _getPlatform(platform.url, platform.clientId, _ENCRYPTIONKEY, _Database);
        }
    }
    /**
     * @description Gets a platform.
     */
    async getPlatform(url, clientId, ENCRYPTIONKEY, Database) {
        if (!url)
            throw new Error('MISSING_PLATFORM_URL');
        const _Database = Database || this.Database;
        const _ENCRYPTIONKEY = ENCRYPTIONKEY || __classPrivateFieldGet(this, _Provider_ENCRYPTIONKEY, "f");
        if (clientId) {
            const result = await _Database.Get(false, 'platform', { platformUrl: url, clientId });
            if (!result)
                return false;
            const plat = result[0];
            const platform = new Platform_1.default(plat.platformName, plat.platformUrl, plat.clientId, plat.authEndpoint, plat.accesstokenEndpoint, plat.authorizationServer, plat.kid, _ENCRYPTIONKEY, plat.authConfig, _Database);
            return platform;
        }
        const result = await _Database.Get(false, 'platform', { platformUrl: url });
        if (!result)
            return false;
        const platforms = [];
        for (const plat of result) {
            const platform = new Platform_1.default(plat.platformName, plat.platformUrl, plat.clientId, plat.authEndpoint, plat.accesstokenEndpoint, plat.authorizationServer, plat.kid, _ENCRYPTIONKEY, plat.authConfig, _Database);
            platforms.push(platform);
        }
        return platforms;
    }
    /**
     * @description Gets a platform by the platformId.
     */
    async getPlatformById(platformId) {
        if (!platformId)
            throw new Error('MISSING_PLATFORM_ID');
        const result = await this.Database.Get(false, 'platform', { kid: platformId });
        if (!result)
            return false;
        const plat = result[0];
        const platform = new Platform_1.default(plat.platformName, plat.platformUrl, plat.clientId, plat.authEndpoint, plat.accesstokenEndpoint, plat.authorizationServer, plat.kid, __classPrivateFieldGet(this, _Provider_ENCRYPTIONKEY, "f"), plat.authConfig, this.Database);
        return platform;
    }
    /**
     * @description Updates a platform by the platformId.
     */
    async updatePlatformById(platformId, platformInfo) {
        if (!platformId) {
            throw new Error('MISSING_PLATFORM_ID');
        }
        if (!platformInfo) {
            throw new Error('MISSING_PLATFORM_INFO');
        }
        const platform = await this.getPlatformById(platformId);
        if (!platform)
            return false;
        const oldURL = await platform.platformUrl();
        const oldClientId = await platform.platformClientId();
        const update = {
            url: platformInfo.url || oldURL,
            clientId: platformInfo.clientId || oldClientId,
            name: platformInfo.name || await platform.platformName(),
            authenticationEndpoint: platformInfo.authenticationEndpoint || await platform.platformAuthEndpoint(),
            accesstokenEndpoint: platformInfo.accesstokenEndpoint || await platform.platformAccessTokenEndpoint()
        };
        if (platformInfo.authorizationServer !== undefined)
            update.authorizationServer = platformInfo.authorizationServer;
        const authConfig = await platform.platformAuthConfig();
        update.authConfig = authConfig;
        if (platformInfo.authConfig) {
            if (platformInfo.authConfig.method)
                update.authConfig.method = platformInfo.authConfig.method;
            if (platformInfo.authConfig.key)
                update.authConfig.key = platformInfo.authConfig.key;
        }
        let alteredUrlClientIdFlag = false;
        if (platformInfo.url || platformInfo.clientId) {
            if (platformInfo.url !== oldURL || platformInfo.clientId !== oldClientId)
                alteredUrlClientIdFlag = true;
        }
        if (alteredUrlClientIdFlag) {
            if (await this.Database.Get(false, 'platform', { platformUrl: update.url, clientId: update.clientId }))
                throw new Error('URL_CLIENT_ID_COMBINATION_ALREADY_EXISTS');
        }
        try {
            if (alteredUrlClientIdFlag) {
                await this.Database.Modify(false, 'publickey', { kid: platformId }, { platformUrl: update.url, clientId: update.clientId });
                await this.Database.Modify(false, 'privatekey', { kid: platformId }, { platformUrl: update.url, clientId: update.clientId });
            }
            await this.Database.Modify(false, 'platform', { kid: platformId }, { platformUrl: update.url, clientId: update.clientId, platformName: update.name, authEndpoint: update.authenticationEndpoint, accesstokenEndpoint: update.accesstokenEndpoint, authorizationServer: update.authorizationServer, authConfig: update.authConfig });
            const updatedPlatform = new Platform_1.default(update.name, update.url, update.clientId, update.authenticationEndpoint, update.accesstokenEndpoint, update.authorizationServer, platformId, __classPrivateFieldGet(this, _Provider_ENCRYPTIONKEY, "f"), update.authConfig, this.Database);
            return updatedPlatform;
        }
        catch (err) {
            if (alteredUrlClientIdFlag) {
                await this.Database.Modify(false, 'publickey', { kid: platformId }, { platformUrl: oldURL, clientId: oldClientId });
                await this.Database.Modify(false, 'privatekey', { kid: platformId }, { platformUrl: oldURL, clientId: oldClientId });
            }
            provMainDebug(err.message);
            throw (err);
        }
    }
    /**
     * @description Deletes a platform.
     */
    async deletePlatform(url, clientId) {
        if (!url || !clientId)
            throw new Error('MISSING_PARAM');
        const platform = await this.getPlatform(url, clientId);
        if (platform)
            await platform.delete();
        return true;
    }
    /**
     * @description Deletes a platform by the platform Id.
     */
    async deletePlatformById(platformId) {
        if (!platformId)
            throw new Error('MISSING_PLATFORM_ID');
        const platform = await this.getPlatformById(platformId);
        if (platform)
            await platform.delete();
        return true;
    }
    /**
     * @description Gets all platforms.
     */
    async getAllPlatforms() {
        const platforms = [];
        const result = await this.Database.Get(false, 'platform');
        if (result) {
            for (const plat of result)
                platforms.push(new Platform_1.default(plat.platformName, plat.platformUrl, plat.clientId, plat.authEndpoint, plat.accesstokenEndpoint, plat.authorizationServer, plat.kid, __classPrivateFieldGet(this, _Provider_ENCRYPTIONKEY, "f"), plat.authConfig, this.Database));
            return platforms;
        }
        return [];
    }
    /**
     * @description Redirects to a new location. Passes Ltik if present.
     */
    async redirect(res, path, options) {
        if (!res || !path)
            throw new Error('MISSING_ARGUMENT');
        if (!res.locals.token)
            return res.redirect(path); // If no token is present, just redirects
        provMainDebug('Redirecting to: ', path);
        const token = res.locals.token;
        const pathParts = fast_url_parser_1.default.parse(path);
        const additionalQueries = (options && options.query) ? options.query : {};
        // Updates path variable if this is a new resource
        if ((options && (options.newResource || options.isNewResource))) {
            provMainDebug('Changing context token path to: ' + path);
            await this.Database.Modify(false, 'contexttoken', { contextId: token.platformContext.contextId, user: res.locals.token.user }, { path });
        }
        // Formatting path with queries
        const params = new URLSearchParams(pathParts.search);
        const queries = {};
        for (const [key, value] of params) {
            queries[key] = value;
        }
        // Fixing fast-url-parser bug where port gets assigned to pathname if there's no path
        const portMatch = pathParts.pathname.match(/:[0-9]*/);
        if (portMatch) {
            pathParts.port = portMatch[0].split(':')[1];
            pathParts.pathname = pathParts.pathname.split(portMatch[0]).join('');
        }
        const formattedPath = fast_url_parser_1.default.format({
            protocol: pathParts.protocol,
            hostname: pathParts.hostname,
            pathname: pathParts.pathname,
            port: pathParts.port,
            auth: pathParts.auth,
            hash: pathParts.hash,
            query: {
                ...queries,
                ...additionalQueries,
                ltik: res.locals.ltik
            }
        });
        // Redirects to path with queries
        return res.redirect(formattedPath);
    }
    // Deprecated methods, these methods will be removed in version 6.0
    /* istanbul ignore next */
    /**
     * @deprecated
     */
    appUrl() {
        console.log('Deprecation warning: The appUrl() method is now deprecated and will be removed in the 6.0 release. Use appRoute() instead.');
        return this.appRoute();
    }
    /* istanbul ignore next */
    /**
     * @deprecated
     */
    loginUrl() {
        console.log('Deprecation warning: The loginUrl() method is now deprecated and will be removed in the 6.0 release. Use loginRoute() instead.');
        return this.loginRoute();
    }
    /* istanbul ignore next */
    /**
     * @deprecated
     */
    keysetUrl() {
        console.log('Deprecation warning: The keysetUrl() method is now deprecated and will be removed in the 6.0 release. Use keysetRoute() instead.');
        return this.keysetRoute();
    }
}
_Provider_loginRoute = new WeakMap(), _Provider_appRoute = new WeakMap(), _Provider_keysetRoute = new WeakMap(), _Provider_dynRegRoute = new WeakMap(), _Provider_whitelistedRoutes = new WeakMap(), _Provider_ENCRYPTIONKEY = new WeakMap(), _Provider_devMode = new WeakMap(), _Provider_ltiaas = new WeakMap(), _Provider_tokenMaxAge = new WeakMap(), _Provider_cookieOptions = new WeakMap(), _Provider_setup = new WeakMap(), _Provider_connectCallback = new WeakMap(), _Provider_deepLinkingCallback = new WeakMap(), _Provider_dynamicRegistrationCallback = new WeakMap(), _Provider_sessionTimeoutCallback = new WeakMap(), _Provider_invalidTokenCallback = new WeakMap(), _Provider_unregisteredPlatformCallback = new WeakMap(), _Provider_inactivePlatformCallback = new WeakMap(), _Provider_keyset = new WeakMap(), _Provider_server = new WeakMap();
module.exports = new Provider();
//# sourceMappingURL=Provider.js.map