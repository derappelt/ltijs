import { ValidationParameters, AccessTokenResponse, GetPlatformFn } from '../types/shared';
/**
 * @description Authentication class manages RSA keys and validation of tokens.
 */
declare class Auth {
    /**
     * @description Generates a new keypair for a platform.
     * @param {String} ENCRYPTIONKEY - Encryption key.
     * @returns {String} kid for the keypair.
     */
    static generatePlatformKeyPair(ENCRYPTIONKEY: string, Database: any, platformUrl: string, platformClientId: string): Promise<string>;
    /**
     * @description Resolves a promisse if the token is valid following LTI 1.3 standards.
     * @param {String} token - JWT token to be verified.
     * @param {Boolean} devMode - DevMode option.
     * @param {Object} validationParameters - Stored validation parameters retrieved from database.
     * @param {Function} getPlatform - getPlatform function to get the platform that originated the token.
     * @param {String} ENCRYPTIONKEY - Encription key.
     * @returns {Promise}
     */
    static validateToken(token: string, devMode: boolean, validationParameters: ValidationParameters, getPlatform: GetPlatformFn, ENCRYPTIONKEY: string, Database: any): Promise<any>;
    /**
     * @description Verifies a token.
     * @param {Object} token - Token to be verified.
     * @param {String} key - Key to verify the token.
     * @param {Object} validationParameters - Validation Parameters.
     * @param {Platform} platform - Issuer platform.
     */
    static verifyToken(token: string, key: string, validationParameters: ValidationParameters, platform: any, Database: any): Promise<any>;
    /**
     * @description Validates de token based on the OIDC specifications.
     * @param {Object} token - Id token you wish to validate.
     * @param {Platform} platform - Platform object.
     * @param {Object} validationParameters - Validation parameters.
     */
    static oidcValidation(token: any, platform: any, validationParameters: ValidationParameters, Database: any): Promise<boolean[]>;
    /**
     * @description Validates Aud.
     * @param {Object} token - Id token you wish to validate.
     * @param {Platform} platform - Platform object.
     */
    static validateAud(token: any, platform: any): Promise<boolean>;
    /**
     * @description Validates Aug.
     * @param {String} alg - Algorithm used.
     */
    static validateAlg(alg: string): Promise<boolean>;
    /**
     * @description Validates token max age.
     * @param {Object} token - Id token you wish to validate.
     * @param {Number} maxAge - Max age allowed for the token.
     */
    static validateMaxAge(token: any, maxAge: number | false | undefined): Promise<boolean>;
    /**
     * @description Validates Nonce.
     * @param {Object} token - Id token you wish to validate.
     */
    static validateNonce(token: any, Database: any): Promise<boolean>;
    /**
     * @description Validates de token based on the LTI 1.3 core claims specifications.
     * @param {Object} token - Id token you wish to validate.
     */
    static claimValidation(token: any): Promise<void>;
    /**
     * @description Gets a new access token from the platform.
     * @param {String} scopes - Request scopes
     * @param {Platform} platform - Platform object of the platform you want to access.
     */
    static getAccessToken(scopes: string, platform: any, ENCRYPTIONKEY: string, Database: any): Promise<AccessTokenResponse>;
}
export = Auth;
//# sourceMappingURL=Auth.d.ts.map