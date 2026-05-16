/* Cross-file type definitions for ltijs. */

export type GetPlatformFn = (iss: string, clientId: string, ENCRYPTIONKEY: string, Database: any) => Promise<any>

export interface ValidationParameters {
  iss?: string
  alg?: string
  maxAge?: number | false
}

export interface AccessTokenResponse {
  access_token: string
  token_type: string
  expires_in: number
  scope?: string
}

export interface AuthConfig {
  method: 'RSA_KEY' | 'JWK_KEY' | 'JWK_SET'
  key: string
}

export interface DatabaseConfig {
  url: string
  debug?: boolean
  connection?: Record<string, unknown>
  plugin?: any
}

export interface SslConfig {
  key: string | Buffer
  cert: string | Buffer
}

export interface DynamicRegistrationOptions {
  name: string
  url: string
  redirectUris?: string[]
  customParameters?: Record<string, string>
  autoActivate?: boolean
  useDeepLinking?: boolean
  logo?: string
  description?: string
}

export type CookieSameSite = boolean | 'lax' | 'strict' | 'none'
