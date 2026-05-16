import Platform from '../Utils/Platform';
import GradeService from './Services/Grade';
import DeepLinkingService from './Services/DeepLinking';
import NamesAndRolesService from './Services/NamesAndRoles';
import DynamicRegistration from './Services/DynamicRegistration';
import { AuthConfig, DatabaseConfig, DynamicRegistrationOptions, CookieSameSite } from '../types/shared';
import type { Request as ExpressRequest, Response as ExpressResponse, NextFunction, Application } from 'express';
type AnyHandler = (req: ExpressRequest, res: ExpressResponse, next: NextFunction) => any | Promise<any>;
type ConnectCallback = (token: any, req: ExpressRequest, res: ExpressResponse, next: NextFunction) => any | Promise<any>;
interface ProviderOptions {
    appRoute?: string;
    appUrl?: string;
    loginRoute?: string;
    loginUrl?: string;
    keysetRoute?: string;
    keysetUrl?: string;
    dynRegRoute?: string;
    https?: boolean;
    ssl?: {
        key: string | Buffer;
        cert: string | Buffer;
    };
    staticPath?: string;
    cors?: boolean;
    serverAddon?: (app: Application) => void;
    cookies?: {
        secure?: boolean;
        sameSite?: CookieSameSite;
        domain?: string;
    };
    devMode?: boolean;
    ltiaas?: boolean;
    tokenMaxAge?: number | false;
    dynReg?: DynamicRegistrationOptions;
}
interface OnConnectOptions {
    sameSite?: CookieSameSite;
    secure?: boolean;
    sessionTimeout?: AnyHandler;
    invalidToken?: AnyHandler;
}
interface WhitelistRoute {
    route: string | RegExp;
    method: string;
}
interface DeployOptions {
    port?: number;
    silent?: boolean;
    serverless?: boolean;
}
interface PlatformRegistration {
    url: string;
    name?: string;
    clientId: string;
    authenticationEndpoint?: string;
    accesstokenEndpoint?: string;
    authorizationServer?: string;
    authConfig?: AuthConfig;
}
/**
 * @descripttion LTI Provider Class that implements the LTI 1.3 protocol and services.
 */
declare class Provider {
    #private;
    Database: any;
    app: Application;
    Grade: GradeService;
    DeepLinking: DeepLinkingService;
    NamesAndRoles: NamesAndRolesService;
    DynamicRegistration?: DynamicRegistration;
    /**
     * @description Provider configuration method.
     */
    setup(encryptionkey: string, database: DatabaseConfig, options?: ProviderOptions): this;
    /**
     * @description Starts listening to a given port for LTI requests and opens connection to the database.
     */
    deploy(options?: DeployOptions): Promise<boolean>;
    /**
     * @description Closes connection to database and stops server.
     */
    close(options?: {
        silent?: boolean;
    }): Promise<boolean>;
    /**
     * @description Sets the callback function called whenever there's a sucessfull lti 1.3 launch, exposing a "token" object containing the idtoken information.
     */
    onConnect(_connectCallback: ConnectCallback, options?: OnConnectOptions): true;
    /**
     * @description Sets the callback function called whenever there's a sucessfull deep linking launch.
     */
    onDeepLinking(_deepLinkingCallback: ConnectCallback): true;
    /**
     * @description Sets the callback function called whenever there's a sucessfull dynamic registration request.
     */
    onDynamicRegistration(_dynamicRegistrationCallback: AnyHandler): true;
    /**
     * @description Sets the callback function called when no valid session is found during a request validation.
     */
    onSessionTimeout(_sessionTimeoutCallback: AnyHandler): true;
    /**
     * @description Sets the callback function called when the token received fails to be validated.
     */
    onInvalidToken(_invalidTokenCallback: AnyHandler): true;
    /**
     * @description Sets the callback function called when the Platform attempting to login is not registered.
     */
    onUnregisteredPlatform(_unregisteredPlatformCallback: AnyHandler): true;
    /**
     * @description Sets the callback function called when the Platform attempting to login is not activated.
     */
    onInactivePlatform(_inactivePlatformCallback: AnyHandler): true;
    /**
     * @description Gets the main application route that will receive the final decoded Idtoken at the end of a successful launch.
     */
    appRoute(): string;
    /**
     * @description Gets the login route responsible for dealing with the OIDC login flow.
     */
    loginRoute(): string;
    /**
     * @description Gets the keyset route that will be used to retrieve a public jwk keyset.
     */
    keysetRoute(): string;
    /**
     * @description Gets the dynamic registration route that will be used to register platforms dynamically.
     */
    dynRegRoute(): string;
    /**
     * @description Whitelists routes to bypass the Ltijs authentication protocol.
     */
    whitelist(...routes: Array<string | RegExp | {
        route: string | RegExp;
        method: string;
    }>): WhitelistRoute[];
    /**
     * @description Registers a platform.
     */
    registerPlatform(platform: PlatformRegistration, getPlatform?: any, ENCRYPTIONKEY?: string, Database?: any): Promise<Platform>;
    /**
     * @description Gets a platform.
     */
    getPlatform(url: string, clientId?: string, ENCRYPTIONKEY?: string, Database?: any): Promise<Platform | Platform[] | false>;
    /**
     * @description Gets a platform by the platformId.
     */
    getPlatformById(platformId: string): Promise<Platform | false>;
    /**
     * @description Updates a platform by the platformId.
     */
    updatePlatformById(platformId: string, platformInfo: any): Promise<Platform | false>;
    /**
     * @description Deletes a platform.
     */
    deletePlatform(url: string, clientId: string): Promise<boolean>;
    /**
     * @description Deletes a platform by the platform Id.
     */
    deletePlatformById(platformId: string): Promise<boolean>;
    /**
     * @description Gets all platforms.
     */
    getAllPlatforms(): Promise<Platform[]>;
    /**
     * @description Redirects to a new location. Passes Ltik if present.
     */
    redirect(res: ExpressResponse, path: string, options?: {
        newResource?: boolean;
        isNewResource?: boolean;
        query?: Record<string, unknown>;
    }): Promise<void>;
    /**
     * @deprecated
     */
    appUrl(): string;
    /**
     * @deprecated
     */
    loginUrl(): string;
    /**
     * @deprecated
     */
    keysetUrl(): string;
}
declare const _default: Provider;
export = _default;
//# sourceMappingURL=Provider.d.ts.map