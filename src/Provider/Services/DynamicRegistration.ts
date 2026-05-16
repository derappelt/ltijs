/* Provider Dynamic Registration Service */
import got from '../../Utils/Http'
import crypto from 'crypto'
import _url from 'fast-url-parser'
import debug from 'debug'

import Objects from '../../Utils/Objects'
import { DynamicRegistrationOptions } from '../../types/shared'

const provDynamicRegistrationDebug = debug('provider:dynamicRegistrationService')

interface RouteOptions {
  appRoute: string
  loginRoute: string
  keysetRoute: string
}

type RegisterPlatformFn = (platform: Record<string, unknown>, getPlatform: any, ENCRYPTIONKEY: string, Database: any) => Promise<any>
type GetPlatformFn = (iss: string, clientId: string, ENCRYPTIONKEY: string, Database: any) => Promise<any>

class DynamicRegistration {
  #name: string

  #redirectUris: string[]

  #customParameters: Record<string, string>

  #autoActivate: boolean

  #useDeepLinking: boolean

  #logo: string | undefined

  #description: string | undefined

  #hostname: string

  #appUrl: string

  #loginUrl: string

  #keysetUrl: string

  #getPlatform: GetPlatformFn

  #registerPlatform: RegisterPlatformFn

  #ENCRYPTIONKEY = ''

  #Database: any

  constructor (options: DynamicRegistrationOptions, routes: RouteOptions, registerPlatform: RegisterPlatformFn, getPlatform: GetPlatformFn, ENCRYPTIONKEY: string, Database: any) {
    this.#name = options.name
    this.#redirectUris = options.redirectUris || []
    this.#customParameters = options.customParameters || {}
    this.#autoActivate = !!options.autoActivate
    this.#useDeepLinking = options.useDeepLinking === undefined ? true : options.useDeepLinking
    this.#logo = options.logo
    this.#description = options.description
    this.#hostname = this.#getHostname(options.url)
    this.#appUrl = this.#buildUrl(options.url, routes.appRoute)
    this.#loginUrl = this.#buildUrl(options.url, routes.loginRoute)
    this.#keysetUrl = this.#buildUrl(options.url, routes.keysetRoute)
    this.#getPlatform = getPlatform
    this.#registerPlatform = registerPlatform

    this.#ENCRYPTIONKEY = ENCRYPTIONKEY
    this.#Database = Database
  }

  // Helper method to build URLs
  #buildUrl (url: string, path: string): string {
    if (path === '/') return url
    const pathParts = _url.parse(url)
    const portMatch = (pathParts.pathname as string).match(/:[0-9]*/)
    if (portMatch) {
      pathParts.port = portMatch[0].split(':')[1]
      pathParts.pathname = (pathParts.pathname as string).split(portMatch[0]).join('')
    }
    const formattedUrl = _url.format({
      protocol: pathParts.protocol,
      hostname: pathParts.hostname,
      pathname: ((pathParts.pathname as string) + path).replace('//', '/'),
      port: pathParts.port,
      auth: pathParts.auth,
      hash: pathParts.hash,
      search: pathParts.search
    })
    return formattedUrl
  }

  // Helper method to get the url hostname
  #getHostname (url: string): string {
    const pathParts = _url.parse(url)
    let hostname = pathParts.hostname as string
    if (pathParts.port) hostname += ':' + pathParts.port
    return hostname
  }

  /**
   * @description Performs dynamic registration flow.
   */
  async register (openidConfiguration: string, registrationToken?: string, options: Record<string, unknown> = {}): Promise<string> {
    if (!openidConfiguration) throw new Error('MISSING_OPENID_CONFIGURATION')
    provDynamicRegistrationDebug('Starting dynamic registration process')
    // Get Platform registration configurations
    const configuration: any = await got.get(openidConfiguration).json()
    provDynamicRegistrationDebug('Attempting to register Platform with issuer: ', configuration.issuer)
    // Building registration object
    const messages: Array<{ type: string }> = [{ type: 'LtiResourceLinkRequest' }]
    if (this.#useDeepLinking) messages.push({ type: 'LtiDeepLinkingRequest' })
    const registration = Objects.deepMergeObjects({
      application_type: 'web',
      response_types: ['id_token'],
      grant_types: ['implicit', 'client_credentials'],
      initiate_login_uri: this.#loginUrl,
      redirect_uris: [...this.#redirectUris, this.#appUrl],
      client_name: this.#name,
      jwks_uri: this.#keysetUrl,
      logo_uri: this.#logo,
      token_endpoint_auth_method: 'private_key_jwt',
      scope: 'https://purl.imsglobal.org/spec/lti-ags/scope/lineitem.readonly https://purl.imsglobal.org/spec/lti-ags/scope/lineitem https://purl.imsglobal.org/spec/lti-ags/scope/score https://purl.imsglobal.org/spec/lti-ags/scope/result.readonly https://purl.imsglobal.org/spec/lti-nrps/scope/contextmembership.readonly',
      'https://purl.imsglobal.org/spec/lti-tool-configuration': {
        domain: this.#hostname,
        description: this.#description,
        target_link_uri: this.#appUrl,
        custom_parameters: this.#customParameters,
        claims: configuration.claims_supported,
        messages
      }
    }, options)
    provDynamicRegistrationDebug('Tool registration request:')
    provDynamicRegistrationDebug(registration)
    provDynamicRegistrationDebug('Sending Tool registration request')
    const registrationResponse: any = await got.post(configuration.registration_endpoint, { json: registration, headers: registrationToken ? { Authorization: 'Bearer ' + registrationToken } : undefined }).json()

    // Registering Platform
    const platformName = (configuration['https://purl.imsglobal.org/spec/lti-platform-configuration'] ? configuration['https://purl.imsglobal.org/spec/lti-platform-configuration'].product_family_code : 'Platform') + '_DynReg_' + crypto.randomBytes(16).toString('hex')

    if (await this.#getPlatform(configuration.issuer, registrationResponse.client_id, this.#ENCRYPTIONKEY, this.#Database)) throw new Error('PLATFORM_ALREADY_REGISTERED')

    provDynamicRegistrationDebug('Registering Platform')
    const platform = {
      url: configuration.issuer,
      name: platformName,
      clientId: registrationResponse.client_id,
      authenticationEndpoint: configuration.authorization_endpoint,
      accesstokenEndpoint: configuration.token_endpoint,
      authorizationServer: configuration.authorization_server || configuration.token_endpoint,
      authConfig: {
        method: 'JWK_SET',
        key: configuration.jwks_uri
      }
    }
    const registered = await this.#registerPlatform(platform, this.#getPlatform, this.#ENCRYPTIONKEY, this.#Database)
    await this.#Database.Insert(false, 'platformStatus', { id: await registered.platformId(), active: this.#autoActivate })

    // Returing message indicating the end of registration flow
    return '<script>(window.opener || window.parent).postMessage({subject:"org.imsglobal.lti.close"}, "*");</script>'
  }
}

export = DynamicRegistration
