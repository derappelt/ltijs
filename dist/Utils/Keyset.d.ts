declare class Keyset {
    /**
     * @description Handles the creation of jwk keyset.
     */
    static build(Database: any, ENCRYPTIONKEY: string): Promise<{
        keys: Record<string, unknown>[];
    }>;
}
export = Keyset;
//# sourceMappingURL=Keyset.d.ts.map