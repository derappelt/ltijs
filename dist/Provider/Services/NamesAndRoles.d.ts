import { GetPlatformFn } from '../../types/shared';
interface MembersOptions {
    role?: string;
    limit?: number;
    pages?: number | false;
    url?: string;
    resourceLinkId?: boolean;
}
declare class NamesAndRoles {
    #private;
    constructor(getPlatform: GetPlatformFn, ENCRYPTIONKEY: string, Database: any);
    /**
     * @description Retrieves members from platform.
     */
    getMembers(idtoken: any, options?: MembersOptions): Promise<any>;
}
export = NamesAndRoles;
//# sourceMappingURL=NamesAndRoles.d.ts.map