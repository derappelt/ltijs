/* Handle jwk keyset generation */
import Jwk from 'rasha'
import debug from 'debug'

const provKeysetDebug = debug('provider:keyset')

interface PublicKeyEntry {
  key: string
  kid: string
}

class Keyset {
  /**
   * @description Handles the creation of jwk keyset.
   */
  static async build (Database: any, ENCRYPTIONKEY: string): Promise<{ keys: Record<string, unknown>[] }> {
    provKeysetDebug('Generating JWK keyset')
    const keys: PublicKeyEntry[] = (await Database.Get(ENCRYPTIONKEY, 'publickey')) || []
    const keyset: { keys: Record<string, unknown>[] } = { keys: [] }
    for (const key of keys) {
      const jwk = await Jwk.import({ pem: key.key })
      jwk.kid = key.kid
      jwk.alg = 'RS256'
      jwk.use = 'sig'
      keyset.keys.push(jwk)
    }
    return keyset
  }
}

export = Keyset
