/* eslint-disable require-atomic-updates */
/* eslint-disable no-useless-escape */

/* Main class for the Provider functionalities */

import Server from '../Utils/Server'
import Request from '../Utils/Request'
import Platform from '../Utils/Platform'
import Auth from '../Utils/Auth'
import DB from '../Utils/Database'
import Keyset from '../Utils/Keyset'

import GradeService from './Services/Grade'
import DeepLinkingService from './Services/DeepLinking'
import NamesAndRolesService from './Services/NamesAndRoles'
import DynamicRegistration from './Services/DynamicRegistration'
import { AuthConfig, DatabaseConfig, DynamicRegistrationOptions, CookieSameSite } from '../types/shared'

import url from 'fast-url-parser'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import debug from 'debug'

import type { Request as ExpressRequest, Response as ExpressResponse, NextFunction, Application } from 'express'

const provAuthDebug = debug('provider:auth')
const provMainDebug = debug('provider:main')
const provDynamicRegistrationDebug = debug('provider:dynamicRegistrationService')

type AnyHandler = (req: ExpressRequest, res: ExpressResponse, next: NextFunction) => any | Promise<any>
type ConnectCallback = (token: any, req: ExpressRequest, res: ExpressResponse, next: NextFunction) => any | Promise<any>

interface CookieOptions {
  secure: boolean
  httpOnly: boolean
  signed: boolean
  sameSite?: CookieSameSite
  domain?: string
  maxAge?: number
}

interface ProviderOptions {
  appRoute?: string
  appUrl?: string
  loginRoute?: string
  loginUrl?: string
  keysetRoute?: string
  keysetUrl?: string
  dynRegRoute?: string
  https?: boolean
  ssl?: { key: string | Buffer, cert: string | Buffer }
  staticPath?: string
  cors?: boolean
  serverAddon?: (app: Application) => void
  cookies?: { secure?: boolean, sameSite?: CookieSameSite, domain?: string }
  devMode?: boolean
  ltiaas?: boolean
  tokenMaxAge?: number | false
  dynReg?: DynamicRegistrationOptions
}

interface OnConnectOptions {
  sameSite?: CookieSameSite
  secure?: boolean
  sessionTimeout?: AnyHandler
  invalidToken?: AnyHandler
}

interface WhitelistRoute {
  route: string | RegExp
  method: string
}

interface DeployOptions {
  port?: number
  silent?: boolean
  serverless?: boolean
}

interface PlatformRegistration {
  url: string
  name?: string
  clientId: string
  authenticationEndpoint?: string
  accesstokenEndpoint?: string
  authorizationServer?: string
  authConfig?: AuthConfig
}

/**
 * @descripttion LTI Provider Class that implements the LTI 1.3 protocol and services.
 */
class Provider {
  // Pre-initiated variables
  #loginRoute = '/login'

  #appRoute = '/'

  #keysetRoute = '/keys'

  #dynRegRoute = '/register'

  #whitelistedRoutes: WhitelistRoute[] = []

  #ENCRYPTIONKEY!: string

  #devMode = false
  #ltiaas = false

  #tokenMaxAge: number | false = 10

  #cookieOptions: CookieOptions = {
    secure: false,
    httpOnly: true,
    signed: true
  }

  // Setup flag
  #setup = false

  #connectCallback: ConnectCallback = async (token, req, res, next) => { return next() }

  #deepLinkingCallback: ConnectCallback = async (token, req, res, next) => { return next() }

  #dynamicRegistrationCallback: AnyHandler = async (req, res, next) => {
    try {
      if (!req.query.openid_configuration) return res.status(400).send({ status: 400, error: 'Bad Request', details: { message: 'Missing parameter: "openid_configuration".' } })
      const message = await this.DynamicRegistration!.register(req.query.openid_configuration as string, req.query.registration_token as string | undefined)
      res.setHeader('Content-type', 'text/html')
      res.send(message)
    } catch (err: any) {
      provDynamicRegistrationDebug(err)
      if (err.message === 'PLATFORM_ALREADY_REGISTERED') return res.status(403).send({ status: 403, error: 'Forbidden', details: { message: 'Platform already registered.' } })
      return res.status(500).send({ status: 500, error: 'Internal Server Error', details: { message: err.message } })
    }
  }

  #sessionTimeoutCallback: AnyHandler = async (req, res) => {
    return res.status(401).send(res.locals.err)
  }

  #invalidTokenCallback: AnyHandler = async (req, res) => {
    return res.status(401).send(res.locals.err)
  }

  #unregisteredPlatformCallback: AnyHandler = async (req, res) => {
    return res.status(400).send({ status: 400, error: 'Bad Request', details: { message: 'UNREGISTERED_PLATFORM' } })
  }

  #inactivePlatformCallback: AnyHandler = async (req, res) => {
    return res.status(401).send({ status: 401, error: 'Unauthorized', details: { message: 'PLATFORM_NOT_ACTIVATED' } })
  }

  // Assembles and sends keyset
  #keyset: AnyHandler = async (req, res) => {
    try {
      const keyset = await Keyset.build(this.Database, this.#ENCRYPTIONKEY)
      return res.status(200).send(keyset)
    } catch (err: any) {
      provMainDebug(err)
      return res.status(500).send({ status: 500, error: 'Internal Server Error', details: { message: err.message } })
    }
  }

  #server!: Server

  Database!: any

  app!: Application

  Grade!: GradeService

  DeepLinking!: DeepLinkingService

  NamesAndRoles!: NamesAndRolesService

  DynamicRegistration?: DynamicRegistration

  /**
   * @description Provider configuration method.
   */
  setup (encryptionkey: string, database: DatabaseConfig, options?: ProviderOptions): this {
    if (this.#setup) throw new Error('PROVIDER_ALREADY_SETUP')
    if (options && options.https && (!options.ssl || !options.ssl.key || !options.ssl.cert)) throw new Error('MISSING_SSL_KEY_CERTIFICATE')
    if (!encryptionkey) throw new Error('MISSING_ENCRYPTION_KEY')
    if (!database) throw new Error('MISSING_DATABASE_CONFIGURATION')
    if (options && options.dynReg && (!options.dynReg.url || !options.dynReg.name)) throw new Error('MISSING_DYNREG_CONFIGURATION')

    /**
     * @description Database object.
     */
    if (!database.plugin) this.Database = new DB(database)
    else this.Database = database.plugin

    if (options && (options.appRoute || options.appUrl)) this.#appRoute = (options.appRoute || options.appUrl) as string
    if (options && (options.loginRoute || options.loginUrl)) this.#loginRoute = (options.loginRoute || options.loginUrl) as string
    if (options && (options.keysetRoute || options.keysetUrl)) this.#keysetRoute = (options.keysetRoute || options.keysetUrl) as string
    if (options && options.dynRegRoute) this.#dynRegRoute = options.dynRegRoute

    if (options && options.devMode === true) this.#devMode = true
    if (options && options.ltiaas === true) this.#ltiaas = true
    if (options && options.tokenMaxAge !== undefined) this.#tokenMaxAge = options.tokenMaxAge

    // Cookie options
    if (options && options.cookies) {
      if (options.cookies.secure === true) this.#cookieOptions.secure = true
      if (options.cookies.sameSite) this.#cookieOptions.sameSite = options.cookies.sameSite
      if (options.cookies.domain) this.#cookieOptions.domain = options.cookies.domain
    }

    this.#ENCRYPTIONKEY = encryptionkey

    this.#server = new Server(options ? options.https : false, options && options.ssl ? options.ssl : false, this.#ENCRYPTIONKEY, options ? options.cors : true, options ? options.serverAddon : undefined)

    /**
     * @description Express server object.
     */
    this.app = this.#server.app

    /**
     * @description Grading service.
     */
    this.Grade = new GradeService(this.getPlatform.bind(this) as any, this.#ENCRYPTIONKEY, this.Database)

    /**
     * @description Deep Linking service.
     */
    this.DeepLinking = new DeepLinkingService(this.getPlatform.bind(this) as any, this.#ENCRYPTIONKEY, this.Database)

    /**
     * @description Names and Roles service.
     */
    this.NamesAndRoles = new NamesAndRolesService(this.getPlatform.bind(this) as any, this.#ENCRYPTIONKEY, this.Database)

    if (options && options.dynReg) {
      const routes = {
        appRoute: this.#appRoute,
        loginRoute: this.#loginRoute,
        keysetRoute: this.#keysetRoute
      }
      /**
       * @description Dynamic Registration service.
       */
      this.DynamicRegistration = new DynamicRegistration(options.dynReg, routes, this.registerPlatform.bind(this) as any, this.getPlatform.bind(this) as any, this.#ENCRYPTIONKEY, this.Database)
    }

    if (options && options.staticPath) this.#server.setStaticPath(options.staticPath)

    // Registers main athentication and routing middleware
    const sessionValidator: AnyHandler = async (req, res, next) => {
      provMainDebug('Receiving request at path: ' + req.baseUrl + req.path)
      // Ckeck if request is attempting to initiate oidc login flow or access reserved routes
      if (req.path === this.#loginRoute || req.path === this.#keysetRoute || req.path === this.#dynRegRoute) return next()

      provMainDebug('Path does not match reserved endpoints')

      try {
        // Retrieving ltik token
        const ltik = req.token
        // Retrieving cookies
        const cookies = req.signedCookies
        provMainDebug('Cookies received: ')
        provMainDebug(cookies)

        if (!ltik) {
          const idtoken = req.body.id_token
          if (idtoken) {
            // No ltik found but request contains an idtoken
            provMainDebug('Received idtoken for validation')

            // Retrieves state
            const state = req.body.state

            // Retrieving validation parameters from cookies
            provAuthDebug('Response state: ' + state)
            const validationCookie = cookies['state' + state]

            const validationParameters = {
              iss: validationCookie,
              maxAge: this.#tokenMaxAge
            }

            const valid = await Auth.validateToken(idtoken, this.#devMode, validationParameters, this.getPlatform.bind(this) as any, this.#ENCRYPTIONKEY, this.Database)

            // Retrieve State object from Database
            const savedState = await this.Database.Get(false, 'state', { state })

            // Deletes state validation cookie and Database entry
            res.clearCookie('state' + state, this.#cookieOptions)
            if (savedState) this.Database.Delete('state', { state })

            provAuthDebug('Successfully validated token!')

            const courseId = valid['https://purl.imsglobal.org/spec/lti/claim/context'] ? valid['https://purl.imsglobal.org/spec/lti/claim/context'].id : 'NF'
            const resourceId = valid['https://purl.imsglobal.org/spec/lti/claim/resource_link'] ? valid['https://purl.imsglobal.org/spec/lti/claim/resource_link'].id : 'NF'

            const clientId = valid.clientId
            const deploymentId = valid['https://purl.imsglobal.org/spec/lti/claim/deployment_id']

            const additionalContextProperties = {
              path: req.path,
              roles: valid['https://purl.imsglobal.org/spec/lti/claim/roles'],
              targetLinkUri: valid['https://purl.imsglobal.org/spec/lti/claim/target_link_uri'],
              custom: valid['https://purl.imsglobal.org/spec/lti/claim/custom'],
              launchPresentation: valid['https://purl.imsglobal.org/spec/lti/claim/launch_presentation'],
              endpoint: valid['https://purl.imsglobal.org/spec/lti-ags/claim/endpoint'],
              namesRoles: valid['https://purl.imsglobal.org/spec/lti-nrps/claim/namesroleservice']
            }

            const hashOfAdditionalContextProperties = crypto.createHash('sha256').update(JSON.stringify(additionalContextProperties)).digest('hex')

            // Appending hashOfContextProperties is a temporary fix to prevent overwriting existing database entries in some scenarios. See: https://github.com/Cvmcosta/ltijs/issues/181
            const contextId = encodeURIComponent(valid.iss + clientId + deploymentId + courseId + '_' + resourceId + '_' + hashOfAdditionalContextProperties)

            const platformCode = encodeURIComponent('lti' + Buffer.from(valid.iss + clientId + deploymentId).toString('base64'))

            // Mount platform token
            const platformToken = {
              iss: valid.iss,
              user: valid.sub,
              userInfo: {
                given_name: valid.given_name,
                family_name: valid.family_name,
                name: valid.name,
                email: valid.email
              },
              platformInfo: valid['https://purl.imsglobal.org/spec/lti/claim/tool_platform'],
              clientId: valid.clientId,
              platformId: valid.platformId,
              deploymentId: valid['https://purl.imsglobal.org/spec/lti/claim/deployment_id']
            }

            // Store idToken in database
            await this.Database.Replace(false, 'idtoken', { iss: valid.iss, clientId, deploymentId, user: valid.sub }, platformToken)

            // Mount context token
            const contextToken = {
              contextId,
              user: valid.sub,
              context: valid['https://purl.imsglobal.org/spec/lti/claim/context'],
              resource: valid['https://purl.imsglobal.org/spec/lti/claim/resource_link'],
              messageType: valid['https://purl.imsglobal.org/spec/lti/claim/message_type'],
              version: valid['https://purl.imsglobal.org/spec/lti/claim/version'],
              deepLinkingSettings: valid['https://purl.imsglobal.org/spec/lti-dl/claim/deep_linking_settings'],
              lis: valid['https://purl.imsglobal.org/spec/lti/claim/lis'],
              ...additionalContextProperties
            }

            // Store contextToken in database
            await this.Database.Replace(false, 'contexttoken', { contextId, user: valid.sub }, contextToken)

            // Creates platform session cookie
            if (!this.#ltiaas) res.cookie(platformCode, valid.sub, this.#cookieOptions)

            provMainDebug('Generating ltik')
            const newLtikObj = {
              platformUrl: valid.iss,
              clientId,
              deploymentId,
              platformCode,
              contextId,
              user: valid.sub,
              s: state // Added state to make unique ltiks
            }
            // Signing context token
            const newLtik = jwt.sign(newLtikObj, this.#ENCRYPTIONKEY)

            if (this.#ltiaas) {
              // Appending query parameters
              res.locals.query = {}
              if (savedState) {
                for (const [key, value] of Object.entries(savedState[0].query)) {
                  ;(req.query as any)[key] = value
                  res.locals.query[key] = value
                }
              }

              // Creating local variables
              res.locals.context = JSON.parse(JSON.stringify(contextToken))
              res.locals.token = JSON.parse(JSON.stringify(platformToken))
              res.locals.token.platformContext = res.locals.context
              res.locals.ltik = newLtik
              provMainDebug('Forwarding request to next handler')
              return next()
            }

            // Appending query parameters
            const query = new URLSearchParams(req.query as any)
            if (savedState) {
              for (const [key, value] of Object.entries(savedState[0].query)) {
                query.append(key, value as string)
              }
            }
            query.append('ltik', newLtik)
            const urlSearchParams = query.toString()
            provMainDebug('Redirecting to endpoint with ltik')
            return res.redirect(req.baseUrl + req.path + '?' + urlSearchParams)
          } else {
            const state = req.body.state
            if (state) {
              provMainDebug('Deleting state cookie and Database entry')
              const savedState = await this.Database.Get(false, 'state', { state })
              res.clearCookie('state' + state, this.#cookieOptions)
              if (savedState) this.Database.Delete('state', { state })
            }

            if (this.#whitelistedRoutes.find(r => {
              if ((r.route instanceof RegExp && r.route.test(req.path)) || r.route === req.path) return r.method === 'ALL' || r.method === req.method.toUpperCase()
              return false
            })) {
              provMainDebug('Accessing as whitelisted route')
              return next()
            }
            provMainDebug('No ltik found')
            provMainDebug('Request body: ', req.body)
            provMainDebug('Passing request to invalid token handler')
            res.locals.err = {
              status: 401,
              error: 'Unauthorized',
              details: {
                description: 'No Ltik or ID Token found.',
                message: 'NO_LTIK_OR_IDTOKEN_FOUND',
                bodyReceived: req.body
              }
            }
            return this.#invalidTokenCallback(req, res, next)
          }
        }

        provMainDebug('Ltik found')
        let validLtik: any
        try {
          validLtik = jwt.verify(ltik, this.#ENCRYPTIONKEY)
        } catch (err) {
          if (this.#whitelistedRoutes.find(r => {
            if ((r.route instanceof RegExp && r.route.test(req.path)) || r.route === req.path) return r.method === 'ALL' || r.method === req.method.toUpperCase()
            return false
          })) {
            provMainDebug('Accessing as whitelisted route')
            return next()
          }
          throw (err)
        }
        provMainDebug('Ltik successfully verified')

        const platformUrl = validLtik.platformUrl
        const platformCode = validLtik.platformCode
        const clientId = validLtik.clientId
        const deploymentId = validLtik.deploymentId
        const contextId = validLtik.contextId
        let user: any = validLtik.user

        if (!this.#ltiaas) {
          provMainDebug('Attempting to retrieve matching session cookie')
          const cookieUser = cookies[platformCode]
          if (!cookieUser) {
            if (!this.#devMode) user = false
            else { provMainDebug('Dev Mode enabled: Missing session cookies will be ignored') }
          } else if (user.toString() !== cookieUser.toString()) user = false
        }

        if (user) {
          provAuthDebug('Valid session found')
          // Gets corresponding id token from database
          let idTokenRes: any = await this.Database.Get(false, 'idtoken', { iss: platformUrl, clientId, deploymentId, user })
          if (!idTokenRes) throw new Error('IDTOKEN_NOT_FOUND_DB')
          idTokenRes = idTokenRes[0]
          const idToken = JSON.parse(JSON.stringify(idTokenRes))

          // Gets correspondent context token from database
          let contextToken: any = await this.Database.Get(false, 'contexttoken', { contextId, user })
          if (!contextToken) throw new Error('CONTEXTTOKEN_NOT_FOUND_DB')
          contextToken = contextToken[0]
          idToken.platformContext = JSON.parse(JSON.stringify(contextToken))

          // Creating local variables
          res.locals.context = idToken.platformContext
          res.locals.token = idToken
          res.locals.ltik = ltik

          provMainDebug('Passing request to next handler')
          return next()
        } else {
          provMainDebug('No session cookie found')
          provMainDebug('Request body: ', req.body)
          provMainDebug('Passing request to session timeout handler')
          res.locals.err = {
            status: 401,
            error: 'Unauthorized',
            details: {
              message: 'Session not found.'
            }
          }
          return this.#sessionTimeoutCallback(req, res, next)
        }
      } catch (err: any) {
        const state = req.body.state
        if (state) {
          provMainDebug('Deleting state cookie and Database entry')
          const savedState = await this.Database.Get(false, 'state', { state })
          res.clearCookie('state' + state, this.#cookieOptions)
          if (savedState) this.Database.Delete('state', { state })
        }

        provAuthDebug(err)
        provMainDebug('Passing request to invalid token handler')

        res.locals.err = {
          status: 401,
          error: 'Unauthorized',
          details: {
            description: 'Error validating ltik or IdToken',
            message: err.message
          }
        }
        return this.#invalidTokenCallback(req, res, next)
      }
    }

    this.app.use(sessionValidator)

    this.app.all(this.#loginRoute, async (req, res) => {
      const params = { ...req.query, ...req.body }
      try {
        if (!params.iss || !params.login_hint || !params.target_link_uri) return res.status(400).send({ status: 400, error: 'Bad Request', details: { message: 'MISSING_LOGIN_PARAMETERS' } })
        const iss = params.iss
        const clientId = params.client_id
        provMainDebug('Receiving a login request from: ' + iss + ', clientId: ' + clientId)
        let platform: any
        if (clientId) platform = await this.getPlatform(iss, clientId)
        else platform = (await this.getPlatform(iss) as any)[0]

        if (platform) {
          const platformActive = await platform.platformActive()
          if (!platformActive) return this.#inactivePlatformCallback(req, res, () => {})

          provMainDebug('Redirecting to platform authentication endpoint')
          // Create state parameter used to validade authentication response
          let state = encodeURIComponent(crypto.randomBytes(25).toString('hex'))

          provMainDebug('Target Link URI: ', params.target_link_uri)
          /* istanbul ignore next */
          // Cleaning up target link uri and retrieving query parameters
          if (params.target_link_uri.includes('?')) {
            // Retrieve raw queries
            const rawQueries = new URLSearchParams('?' + params.target_link_uri.split('?')[1])
            // Check if state is unique
            while (await this.Database.Get(false, 'state', { state })) state = encodeURIComponent(crypto.randomBytes(25).toString('hex'))
            provMainDebug('Generated state: ', state)
            // Assemble queries object
            const queries: Record<string, string> = {}
            for (const [key, value] of rawQueries) { queries[key] = value }
            params.target_link_uri = params.target_link_uri.split('?')[0]
            provMainDebug('Query parameters found: ', queries)
            provMainDebug('Final Redirect URI: ', params.target_link_uri)
            // Store state and query parameters on database
            await this.Database.Insert(false, 'state', { state, query: queries })
          }

          // Setting up validation info
          const cookieOptions = JSON.parse(JSON.stringify(this.#cookieOptions))
          cookieOptions.maxAge = 60 * 1000 // Adding max age to state cookie = 1min
          res.cookie('state' + state, iss, cookieOptions)

          // Redirect to authentication endpoint
          const query = await Request.ltiAdvantageLogin(params, platform, state)
          provMainDebug('Login request: ')
          provMainDebug(query)
          res.redirect(url.format({
            pathname: await platform.platformAuthEndpoint(),
            query: query as unknown as Record<string, unknown>
          }))
        } else {
          provMainDebug('Unregistered platform attempting connection: ' + iss + ', clientId: ' + clientId)
          return this.#unregisteredPlatformCallback(req, res, () => {})
        }
      } catch (err: any) {
        provMainDebug(err)
        return res.status(500).send({ status: 500, error: 'Internal Server Error', details: { message: err.message } })
      }
    })

    this.app.get(this.#keysetRoute, async (req, res, next) => {
      return this.#keyset(req, res, next)
    })

    this.app.all(this.#dynRegRoute, async (req, res, next) => {
      if (this.DynamicRegistration) return this.#dynamicRegistrationCallback(req, res, next)
      return res.status(403).send({ status: 403, error: 'Forbidden', details: { message: 'Dynamic registration is disabled.' } })
    })

    // Main app
    this.app.all(this.#appRoute, async (req, res, next) => {
      if (res.locals.context && res.locals.context.messageType === 'LtiDeepLinkingRequest') return this.#deepLinkingCallback(res.locals.token, req, res, next)
      return this.#connectCallback(res.locals.token, req, res, next)
    })

    this.#setup = true
    return this
  }

  /**
   * @description Starts listening to a given port for LTI requests and opens connection to the database.
   */
  async deploy (options?: DeployOptions): Promise<boolean> {
    if (!this.#setup) throw new Error('PROVIDER_NOT_SETUP')
    provMainDebug('Attempting to connect to database')
    try {
      await this.Database.setup()

      const conf: { port: number, silent: boolean } = {
        port: 3000,
        silent: false
      }

      if (options && options.port) conf.port = options.port
      if (options && options.silent) conf.silent = options.silent
      // Starts server on given port

      if (options && options.serverless) {
        if (!conf.silent) {
          console.log('Ltijs started in serverless mode...')
        }
      } else {
        await this.#server.listen(conf.port)
        provMainDebug('Ltijs started listening on port: ', conf.port)

        // Startup message
        const message = 'LTI Provider is listening on port ' + conf.port + '!\n\n LTI provider config: \n >App Route: ' + this.#appRoute + '\n >Initiate Login Route: ' + this.#loginRoute + '\n >Keyset Route: ' + this.#keysetRoute + '\n >Dynamic Registration Route: ' + this.#dynRegRoute

        if (!conf.silent) {
          console.log('  _   _______ _____      _  _____\n' +
                      ' | | |__   __|_   _|    | |/ ____|\n' +
                      ' | |    | |    | |      | | (___  \n' +
                      ' | |    | |    | |  _   | |\\___ \\ \n' +
                      ' | |____| |   _| |_| |__| |____) |\n' +
                      ' |______|_|  |_____|\\____/|_____/ \n\n', message)
        }
      }
      if (this.#devMode && !conf.silent) console.log('\nStarting in Dev Mode, state validation and session cookies will not be required. THIS SHOULD NOT BE USED IN A PRODUCTION ENVIRONMENT!')

      // Sets up gracefull shutdown
      process.on('SIGINT', async () => {
        await this.close(options)
        process.exit()
      })

      return true
    } catch (err) {
      console.log('Error during deployment: ', err)
      await this.close(options)
      process.exit()
    }
  }

  /**
   * @description Closes connection to database and stops server.
   */
  async close (options?: { silent?: boolean }): Promise<boolean> {
    if (!options || options.silent !== true) console.log('\nClosing server...')
    await this.#server.close()
    if (!options || options.silent !== true) console.log('Closing connection to the database...')
    await this.Database.Close()
    if (!options || options.silent !== true) console.log('Shutdown complete.')
    return true
  }

  /**
   * @description Sets the callback function called whenever there's a sucessfull lti 1.3 launch, exposing a "token" object containing the idtoken information.
   */
  onConnect (_connectCallback: ConnectCallback, options?: OnConnectOptions): true {
    /* istanbul ignore next */
    if (options) {
      if (options.sameSite || options.secure) console.log('Deprecation Warning: The optional parameters of the onConnect() method are now deprecated and will be removed in the 6.0 release. Cookie parameters can be found in the main Ltijs constructor options: ... { cookies: { secure: true, sameSite: \'None\' }.')

      if (options.sessionTimeout || options.invalidToken) console.log('Deprecation Warning: The optional parameters of the onConnect() method are now deprecated and will be removed in the 6.0 release. Invalid token and Session Timeout methods can now be set with the onSessionTimeout() and onInvalidToken() methods.')

      if (options.sameSite) {
        this.#cookieOptions.sameSite = options.sameSite
        if (typeof options.sameSite === 'string' && options.sameSite.toLowerCase() === 'none') this.#cookieOptions.secure = true
      }
      if (options.secure === true) this.#cookieOptions.secure = true
      if (options.sessionTimeout) this.#sessionTimeoutCallback = options.sessionTimeout
      if (options.invalidToken) this.#invalidTokenCallback = options.invalidToken
    }

    if (_connectCallback) {
      this.#connectCallback = _connectCallback
      return true
    }
    throw new Error('MISSING_CALLBACK')
  }

  /**
   * @description Sets the callback function called whenever there's a sucessfull deep linking launch.
   */
  onDeepLinking (_deepLinkingCallback: ConnectCallback): true {
    if (_deepLinkingCallback) {
      this.#deepLinkingCallback = _deepLinkingCallback
      return true
    }
    throw new Error('MISSING_CALLBACK')
  }

  /**
   * @description Sets the callback function called whenever there's a sucessfull dynamic registration request.
   */
  onDynamicRegistration (_dynamicRegistrationCallback: AnyHandler): true {
    if (_dynamicRegistrationCallback) {
      this.#dynamicRegistrationCallback = _dynamicRegistrationCallback
      return true
    }
    throw new Error('MISSING_CALLBACK')
  }

  /**
   * @description Sets the callback function called when no valid session is found during a request validation.
   */
  onSessionTimeout (_sessionTimeoutCallback: AnyHandler): true {
    if (_sessionTimeoutCallback) {
      this.#sessionTimeoutCallback = _sessionTimeoutCallback
      return true
    }
    throw new Error('MISSING_CALLBACK')
  }

  /**
   * @description Sets the callback function called when the token received fails to be validated.
   */
  onInvalidToken (_invalidTokenCallback: AnyHandler): true {
    if (_invalidTokenCallback) {
      this.#invalidTokenCallback = _invalidTokenCallback
      return true
    }
    throw new Error('MISSING_CALLBACK')
  }

  /**
   * @description Sets the callback function called when the Platform attempting to login is not registered.
   */
  onUnregisteredPlatform (_unregisteredPlatformCallback: AnyHandler): true {
    if (_unregisteredPlatformCallback) {
      this.#unregisteredPlatformCallback = _unregisteredPlatformCallback
      return true
    }
    throw new Error('MISSING_CALLBACK')
  }

  /**
   * @description Sets the callback function called when the Platform attempting to login is not activated.
   */
  onInactivePlatform (_inactivePlatformCallback: AnyHandler): true {
    if (_inactivePlatformCallback) {
      this.#inactivePlatformCallback = _inactivePlatformCallback
      return true
    }
    throw new Error('MISSING_CALLBACK')
  }

  /**
   * @description Gets the main application route that will receive the final decoded Idtoken at the end of a successful launch.
   */
  appRoute (): string {
    return this.#appRoute
  }

  /**
   * @description Gets the login route responsible for dealing with the OIDC login flow.
   */
  loginRoute (): string {
    return this.#loginRoute
  }

  /**
   * @description Gets the keyset route that will be used to retrieve a public jwk keyset.
   */
  keysetRoute (): string {
    return this.#keysetRoute
  }

  /**
   * @description Gets the dynamic registration route that will be used to register platforms dynamically.
   */
  dynRegRoute (): string {
    return this.#dynRegRoute
  }

  /**
   * @description Whitelists routes to bypass the Ltijs authentication protocol.
   */
  whitelist (...routes: Array<string | RegExp | { route: string | RegExp, method: string }>): WhitelistRoute[] {
    if (!routes) return this.#whitelistedRoutes
    const formattedRoutes: WhitelistRoute[] = []
    for (const route of routes) {
      const isObject = (!(route instanceof RegExp) && route === Object(route))
      if (isObject) {
        const r = route as { route: string | RegExp, method: string }
        if (!r.route || !r.method) throw new Error('WRONG_FORMAT. Details: Expects string ("/route") or object ({ route: "/route", method: "POST" })')
        formattedRoutes.push({ route: r.route, method: r.method.toUpperCase() })
      } else formattedRoutes.push({ route: route as string | RegExp, method: 'ALL' })
    }
    this.#whitelistedRoutes = [
      ...this.#whitelistedRoutes,
      ...formattedRoutes
    ]

    return this.#whitelistedRoutes
  }

  /**
   * @description Registers a platform.
   */
  async registerPlatform (platform: PlatformRegistration, getPlatform?: any, ENCRYPTIONKEY?: string, Database?: any): Promise<Platform> {
    if (!platform || !platform.url || !platform.clientId) throw new Error('MISSING_PLATFORM_URL_OR_CLIENTID')

    const _Database = Database || this.Database
    const _ENCRYPTIONKEY = ENCRYPTIONKEY || this.#ENCRYPTIONKEY
    const _getPlatform = getPlatform || this.getPlatform.bind(this)

    let kid: string | undefined
    const _platform = await _getPlatform(platform.url, platform.clientId, _ENCRYPTIONKEY, _Database)

    if (!_platform) {
      if (!platform.name || !platform.authenticationEndpoint || !platform.accesstokenEndpoint || !platform.authConfig) throw new Error('MISSING_PARAMS')
      if (platform.authConfig.method !== 'RSA_KEY' && platform.authConfig.method !== 'JWK_KEY' && platform.authConfig.method !== 'JWK_SET') throw new Error('INVALID_AUTHCONFIG_METHOD. Details: Valid methods are "RSA_KEY", "JWK_KEY", "JWK_SET".')
      if (!platform.authConfig.key) throw new Error('MISSING_AUTHCONFIG_KEY')

      try {
        kid = await Auth.generatePlatformKeyPair(_ENCRYPTIONKEY, _Database, platform.url, platform.clientId)
        const plat = new Platform(platform.name, platform.url, platform.clientId, platform.authenticationEndpoint, platform.accesstokenEndpoint, platform.authorizationServer, kid, _ENCRYPTIONKEY, platform.authConfig, this.Database)

        // Save platform to db
        provMainDebug('Registering new platform')
        provMainDebug('Platform Url: ' + platform.url)
        provMainDebug('Platform ClientId: ' + platform.clientId)
        await _Database.Replace(false, 'platform', { platformUrl: platform.url, clientId: platform.clientId }, { platformName: platform.name, platformUrl: platform.url, clientId: platform.clientId, authEndpoint: platform.authenticationEndpoint, accesstokenEndpoint: platform.accesstokenEndpoint, authorizationServer: platform.authorizationServer, kid, authConfig: platform.authConfig })

        return plat
      } catch (err: any) {
        await _Database.Delete('publickey', { kid })
        await _Database.Delete('privatekey', { kid })
        await _Database.Delete('platform', { platformUrl: platform.url, clientId: platform.clientId })
        provMainDebug(err.message)
        throw (err)
      }
    } else {
      provMainDebug('Platform already registered')
      await _Database.Modify(false, 'platform', { platformUrl: platform.url, clientId: platform.clientId }, { platformName: platform.name || await _platform.platformName(), authEndpoint: platform.authenticationEndpoint || await _platform.platformAuthEndpoint(), accesstokenEndpoint: platform.accesstokenEndpoint || await _platform.platformAccessTokenEndpoint(), authorizationServer: platform.authorizationServer || await _platform.platformAuthorizationServer(), authConfig: platform.authConfig || await _platform.platformAuthConfig() })
      return _getPlatform(platform.url, platform.clientId, _ENCRYPTIONKEY, _Database)
    }
  }

  /**
   * @description Gets a platform.
   */
  async getPlatform (url: string, clientId?: string, ENCRYPTIONKEY?: string, Database?: any): Promise<Platform | Platform[] | false> {
    if (!url) throw new Error('MISSING_PLATFORM_URL')

    const _Database = Database || this.Database
    const _ENCRYPTIONKEY = ENCRYPTIONKEY || this.#ENCRYPTIONKEY

    if (clientId) {
      const result = await _Database.Get(false, 'platform', { platformUrl: url, clientId })
      if (!result) return false
      const plat = result[0]
      const platform = new Platform(plat.platformName, plat.platformUrl, plat.clientId, plat.authEndpoint, plat.accesstokenEndpoint, plat.authorizationServer, plat.kid, _ENCRYPTIONKEY, plat.authConfig, _Database)
      return platform
    }

    const result = await _Database.Get(false, 'platform', { platformUrl: url })
    if (!result) return false

    const platforms: Platform[] = []
    for (const plat of result) {
      const platform = new Platform(plat.platformName, plat.platformUrl, plat.clientId, plat.authEndpoint, plat.accesstokenEndpoint, plat.authorizationServer, plat.kid, _ENCRYPTIONKEY, plat.authConfig, _Database)
      platforms.push(platform)
    }

    return platforms
  }

  /**
   * @description Gets a platform by the platformId.
   */
  async getPlatformById (platformId: string): Promise<Platform | false> {
    if (!platformId) throw new Error('MISSING_PLATFORM_ID')

    const result = await this.Database.Get(false, 'platform', { kid: platformId })
    if (!result) return false
    const plat = result[0]
    const platform = new Platform(plat.platformName, plat.platformUrl, plat.clientId, plat.authEndpoint, plat.accesstokenEndpoint, plat.authorizationServer, plat.kid, this.#ENCRYPTIONKEY, plat.authConfig, this.Database)
    return platform
  }

  /**
   * @description Updates a platform by the platformId.
   */
  async updatePlatformById (platformId: string, platformInfo: any): Promise<Platform | false> {
    if (!platformId) { throw new Error('MISSING_PLATFORM_ID') }
    if (!platformInfo) { throw new Error('MISSING_PLATFORM_INFO') }

    const platform = await this.getPlatformById(platformId)
    if (!platform) return false

    const oldURL = await platform.platformUrl()
    const oldClientId = await platform.platformClientId()

    const update: any = {
      url: platformInfo.url || oldURL,
      clientId: platformInfo.clientId || oldClientId,
      name: platformInfo.name || await platform.platformName(),
      authenticationEndpoint: platformInfo.authenticationEndpoint || await platform.platformAuthEndpoint(),
      accesstokenEndpoint: platformInfo.accesstokenEndpoint || await platform.platformAccessTokenEndpoint()
    }
    if (platformInfo.authorizationServer !== undefined) update.authorizationServer = platformInfo.authorizationServer

    const authConfig = await platform.platformAuthConfig()
    update.authConfig = authConfig
    if (platformInfo.authConfig) {
      if (platformInfo.authConfig.method) update.authConfig.method = platformInfo.authConfig.method
      if (platformInfo.authConfig.key) update.authConfig.key = platformInfo.authConfig.key
    }

    let alteredUrlClientIdFlag = false
    if (platformInfo.url || platformInfo.clientId) {
      if (platformInfo.url !== oldURL || platformInfo.clientId !== oldClientId) alteredUrlClientIdFlag = true
    }

    if (alteredUrlClientIdFlag) {
      if (await this.Database.Get(false, 'platform', { platformUrl: update.url, clientId: update.clientId })) throw new Error('URL_CLIENT_ID_COMBINATION_ALREADY_EXISTS')
    }

    try {
      if (alteredUrlClientIdFlag) {
        await this.Database.Modify(false, 'publickey', { kid: platformId }, { platformUrl: update.url, clientId: update.clientId })
        await this.Database.Modify(false, 'privatekey', { kid: platformId }, { platformUrl: update.url, clientId: update.clientId })
      }

      await this.Database.Modify(false, 'platform', { kid: platformId }, { platformUrl: update.url, clientId: update.clientId, platformName: update.name, authEndpoint: update.authenticationEndpoint, accesstokenEndpoint: update.accesstokenEndpoint, authorizationServer: update.authorizationServer, authConfig: update.authConfig })

      const updatedPlatform = new Platform(update.name, update.url, update.clientId, update.authenticationEndpoint, update.accesstokenEndpoint, update.authorizationServer, platformId, this.#ENCRYPTIONKEY, update.authConfig, this.Database)
      return updatedPlatform
    } catch (err: any) {
      if (alteredUrlClientIdFlag) {
        await this.Database.Modify(false, 'publickey', { kid: platformId }, { platformUrl: oldURL, clientId: oldClientId })
        await this.Database.Modify(false, 'privatekey', { kid: platformId }, { platformUrl: oldURL, clientId: oldClientId })
      }
      provMainDebug(err.message)
      throw (err)
    }
  }

  /**
   * @description Deletes a platform.
   */
  async deletePlatform (url: string, clientId: string): Promise<boolean> {
    if (!url || !clientId) throw new Error('MISSING_PARAM')
    const platform = await this.getPlatform(url, clientId)
    if (platform) await (platform as Platform).delete()
    return true
  }

  /**
   * @description Deletes a platform by the platform Id.
   */
  async deletePlatformById (platformId: string): Promise<boolean> {
    if (!platformId) throw new Error('MISSING_PLATFORM_ID')
    const platform = await this.getPlatformById(platformId)
    if (platform) await platform.delete()
    return true
  }

  /**
   * @description Gets all platforms.
   */
  async getAllPlatforms (): Promise<Platform[]> {
    const platforms: Platform[] = []
    const result = await this.Database.Get(false, 'platform')

    if (result) {
      for (const plat of result) platforms.push(new Platform(plat.platformName, plat.platformUrl, plat.clientId, plat.authEndpoint, plat.accesstokenEndpoint, plat.authorizationServer, plat.kid, this.#ENCRYPTIONKEY, plat.authConfig, this.Database))
      return platforms
    }
    return []
  }

  /**
   * @description Redirects to a new location. Passes Ltik if present.
   */
  async redirect (res: ExpressResponse, path: string, options?: { newResource?: boolean, isNewResource?: boolean, query?: Record<string, unknown> }): Promise<void> {
    if (!res || !path) throw new Error('MISSING_ARGUMENT')
    if (!res.locals.token) return res.redirect(path) // If no token is present, just redirects
    provMainDebug('Redirecting to: ', path)
    const token = res.locals.token
    const pathParts = url.parse(path)
    const additionalQueries = (options && options.query) ? options.query : {}

    // Updates path variable if this is a new resource
    if ((options && (options.newResource || options.isNewResource))) {
      provMainDebug('Changing context token path to: ' + path)
      await this.Database.Modify(false, 'contexttoken', { contextId: token.platformContext.contextId, user: res.locals.token.user }, { path })
    }

    // Formatting path with queries
    const params = new URLSearchParams(pathParts.search)
    const queries: Record<string, string> = {}
    for (const [key, value] of params) { queries[key] = value }

    // Fixing fast-url-parser bug where port gets assigned to pathname if there's no path
    const portMatch = (pathParts.pathname as string).match(/:[0-9]*/)
    if (portMatch) {
      pathParts.port = portMatch[0].split(':')[1]
      pathParts.pathname = (pathParts.pathname as string).split(portMatch[0]).join('')
    }
    const formattedPath = url.format({
      protocol: pathParts.protocol,
      hostname: pathParts.hostname,
      pathname: pathParts.pathname,
      port: pathParts.port,
      auth: pathParts.auth,
      hash: pathParts.hash,
      query: {
        ...queries,
        ...additionalQueries,
        ltik: res.locals.ltik
      }
    })

    // Redirects to path with queries
    return res.redirect(formattedPath)
  }

  // Deprecated methods, these methods will be removed in version 6.0

  /* istanbul ignore next */
  /**
   * @deprecated
   */
  appUrl (): string {
    console.log('Deprecation warning: The appUrl() method is now deprecated and will be removed in the 6.0 release. Use appRoute() instead.')
    return this.appRoute()
  }

  /* istanbul ignore next */
  /**
   * @deprecated
   */
  loginUrl (): string {
    console.log('Deprecation warning: The loginUrl() method is now deprecated and will be removed in the 6.0 release. Use loginRoute() instead.')
    return this.loginRoute()
  }

  /* istanbul ignore next */
  /**
   * @deprecated
   */
  keysetUrl (): string {
    console.log('Deprecation warning: The keysetUrl() method is now deprecated and will be removed in the 6.0 release. Use keysetRoute() instead.')
    return this.keysetRoute()
  }
}

export = new Provider()
