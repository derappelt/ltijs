declare class Objects {
    static isObject(item: unknown): item is Record<string, unknown>;
    /**
     * Deep merge two or more objects. taken from https://stackoverflow.com/a/34749873
     * @param target
     * @param ...sources
     */
    static deepMergeObjects(target: any, ...sources: any[]): any;
}
export = Objects;
//# sourceMappingURL=Objects.d.ts.map