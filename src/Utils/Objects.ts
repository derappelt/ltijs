class Objects {
  static isObject (item: unknown): item is Record<string, unknown> {
    return (!!item && typeof item === 'object' && !Array.isArray(item))
  }

  /**
   * Deep merge two or more objects. taken from https://stackoverflow.com/a/34749873
   * @param target
   * @param ...sources
   */
  static deepMergeObjects (target: any, ...sources: any[]): any {
    if (!sources.length) return target
    const source = sources.shift()

    if (Objects.isObject(target) && Objects.isObject(source)) {
      for (const key in source) {
        if (Objects.isObject(source[key])) {
          if (!target[key]) Object.assign(target, { [key]: {} })
          Objects.deepMergeObjects(target[key], source[key])
        } else {
          Object.assign(target, { [key]: source[key] })
        }
      }
    }

    return Objects.deepMergeObjects(target, ...sources)
  }
}

export = Objects
