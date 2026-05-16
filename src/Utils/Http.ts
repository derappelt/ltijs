import got from 'got'
import packageJson from '../../package.json'

/**
 * @description Configures a default HTTP client User-Agent.
 */
const httpClient = got.extend({
  headers: {
    'User-Agent': `ltijs/${packageJson.version}`
  }
})

export = httpClient
