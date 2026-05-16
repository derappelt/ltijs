import { GetPlatformFn, AccessTokenResponse } from '../../types/shared';
interface LineItemOptions {
    resourceLinkId?: boolean;
    resourceId?: string;
    tag?: string;
    limit?: number;
    id?: string;
    label?: string;
    url?: string;
}
interface LineItemsResult {
    lineItems: any[];
    next?: string;
    prev?: string;
    first?: string;
    last?: string;
}
interface ScoreOptions {
    userId?: string;
    limit?: number;
    url?: string;
}
interface ScoresResult {
    scores: any[];
    next?: string;
    prev?: string;
    first?: string;
    last?: string;
}
declare class Grade {
    #private;
    constructor(getPlatform: GetPlatformFn, ENCRYPTIONKEY: string, Database: any);
    /**
     * @description Gets lineitems from a given platform
     */
    getLineItems(idtoken: any, options?: LineItemOptions, accessToken?: AccessTokenResponse): Promise<LineItemsResult>;
    /**
     * @description Creates a new lineItem for the given context
     */
    createLineItem(idtoken: any, lineItem: any, options?: LineItemOptions, accessToken?: AccessTokenResponse): Promise<any>;
    /**
     * @description Gets LineItem by the ID
     */
    getLineItemById(idtoken: any, lineItemId: string, accessToken?: AccessTokenResponse): Promise<any>;
    /**
     * @description Updates LineItem by the ID
     */
    updateLineItemById(idtoken: any, lineItemId: string, lineItem: any): Promise<any>;
    /**
     * @description Deletes LineItem by the ID
     */
    deleteLineItemById(idtoken: any, lineItemId: string): Promise<boolean>;
    /**
     * @description Publishes a score or grade to a lineItem. Represents the Score Publish service described in the lti 1.3 specification.
     */
    submitScore(idtoken: any, lineItemId: string, score: any): Promise<any>;
    /**
     * @description Retrieves scores from a lineItem. Represents the Result service described in the lti 1.3 specification.
     */
    getScores(idtoken: any, lineItemId: string, options?: ScoreOptions): Promise<ScoresResult>;
    /**
     * @deprecated
     */
    deleteLineItems(idtoken: any, options?: LineItemOptions): Promise<{
        success: any[];
        failure: any[];
    }>;
    /**
     * @deprecated
     */
    scorePublish(idtoken: any, score: any, options?: LineItemOptions & {
        autoCreate?: any;
        userId?: string;
    }): Promise<{
        success: any[];
        failure: any[];
    }>;
    /**
     * @deprecated
     */
    result(idtoken: any, options?: LineItemOptions & {
        userId?: string;
    }): Promise<any[]>;
    /**
     * @deprecated
     */
    GetLineItems(idtoken: any, options?: LineItemOptions, accessToken?: AccessTokenResponse): Promise<LineItemsResult>;
    /**
     * @deprecated
     */
    CreateLineItem(idtoken: any, lineItem: any, options?: LineItemOptions, accessToken?: AccessTokenResponse): Promise<any>;
    /**
     * @deprecated
     */
    DeleteLineItems(idtoken: any, options?: LineItemOptions): Promise<{
        success: any[];
        failure: any[];
    }>;
    /**
     * @deprecated
     */
    ScorePublish(idtoken: any, score: any, options?: LineItemOptions & {
        autoCreate?: any;
        userId?: string;
    }): Promise<{
        success: any[];
        failure: any[];
    }>;
    /**
     * @deprecated
     */
    Result(idtoken: any, options?: LineItemOptions & {
        userId?: string;
    }): Promise<any[]>;
}
export = Grade;
//# sourceMappingURL=Grade.d.ts.map