import { DynamicRegistrationOptions } from '../../types/shared';
interface RouteOptions {
    appRoute: string;
    loginRoute: string;
    keysetRoute: string;
}
type RegisterPlatformFn = (platform: Record<string, unknown>, getPlatform: any, ENCRYPTIONKEY: string, Database: any) => Promise<any>;
type GetPlatformFn = (iss: string, clientId: string, ENCRYPTIONKEY: string, Database: any) => Promise<any>;
declare class DynamicRegistration {
    #private;
    constructor(options: DynamicRegistrationOptions, routes: RouteOptions, registerPlatform: RegisterPlatformFn, getPlatform: GetPlatformFn, ENCRYPTIONKEY: string, Database: any);
    /**
     * @description Performs dynamic registration flow.
     */
    register(openidConfiguration: string, registrationToken?: string, options?: Record<string, unknown>): Promise<string>;
}
export = DynamicRegistration;
//# sourceMappingURL=DynamicRegistration.d.ts.map