import { GetPlatformFn } from '../../types/shared';
interface DeepLinkingOptions {
    message?: string;
    errMessage?: string;
    errmessage?: string;
    log?: string;
    errLog?: string;
    errlog?: string;
}
declare class DeepLinking {
    #private;
    constructor(getPlatform: GetPlatformFn, ENCRYPTIONKEY: string, Database: any);
    /**
     * @description Creates an auto submitting form containing the DeepLinking Message.
     */
    createDeepLinkingForm(idtoken: any, contentItems: any, options?: DeepLinkingOptions): Promise<string>;
    /**
     * @description Creates a DeepLinking signed message.
     */
    createDeepLinkingMessage(idtoken: any, contentItems: any, options?: DeepLinkingOptions): Promise<string>;
}
export = DeepLinking;
//# sourceMappingURL=DeepLinking.d.ts.map