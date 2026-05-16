declare namespace Express {
  interface Request {
    token?: string
  }
}

declare module 'rasha' {
  interface JwkImportOptions { pem: string }
  interface JwkExportOptions { jwk: Record<string, unknown> }
  const Jwk: {
    import: (opts: JwkImportOptions) => Promise<Record<string, unknown>>
    export: (opts: JwkExportOptions) => Promise<string>
  }
  export = Jwk
}

declare module 'sprightly' {
  export function sprightly (templatePath: string, data: Record<string, unknown>): string
}

declare module 'fast-url-parser' {
  interface ParsedUrl {
    protocol?: string
    hostname?: string
    port?: string
    pathname?: string
    search?: string
    hash?: string
    host?: string
    auth?: string
    query?: unknown
  }
  interface FormatOptions extends Partial<ParsedUrl> {
    query?: Record<string, unknown> | string | null
  }
  function parse (url: string, parseQueryString?: boolean): ParsedUrl
  function format (parts: FormatOptions): string
  const _default: {
    parse: typeof parse
    format: typeof format
  }
  export = _default
}
