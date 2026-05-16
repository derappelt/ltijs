/* Provider Deep Linking Service */

import jwt from 'jsonwebtoken'
import path from 'path'
import debug from 'debug'
import { sprightly } from 'sprightly'
import { GetPlatformFn } from '../../types/shared'

const provDeepLinkingDebug = debug('provider:deepLinkingService')

// Templates live at dist/Templates/ but this compiled file lives at dist/Provider/Services/,
// so we need to walk up two levels.
const deepLinkSubmissionForm = path.join(__dirname, '..', '..', 'Templates', 'DeepLinkSubmissionForm.html')

interface DeepLinkingOptions {
  message?: string
  errMessage?: string
  errmessage?: string
  log?: string
  errLog?: string
  errlog?: string
}

class DeepLinking {
  #getPlatform: GetPlatformFn

  #ENCRYPTIONKEY = ''

  #Database: any

  constructor (getPlatform: GetPlatformFn, ENCRYPTIONKEY: string, Database: any) {
    this.#getPlatform = getPlatform
    this.#ENCRYPTIONKEY = ENCRYPTIONKEY
    this.#Database = Database
  }

  /**
   * @description Creates an auto submitting form containing the DeepLinking Message.
   */
  async createDeepLinkingForm (idtoken: any, contentItems: any, options?: DeepLinkingOptions): Promise<string> {
    const message = await this.createDeepLinkingMessage(idtoken, contentItems, options)

    // Creating auto submitting form
    const form = sprightly(deepLinkSubmissionForm, { action: idtoken.platformContext.deepLinkingSettings.deep_link_return_url, message })
    return form
  }

  /**
   * @description Creates a DeepLinking signed message.
   */
  async createDeepLinkingMessage (idtoken: any, contentItems: any, options?: DeepLinkingOptions): Promise<string> {
    provDeepLinkingDebug('Starting deep linking process')
    if (!idtoken) { provDeepLinkingDebug('Missing IdToken object.'); throw new Error('MISSING_ID_TOKEN') }
    if (!idtoken.platformContext.deepLinkingSettings) { provDeepLinkingDebug('DeepLinkingSettings object missing.'); throw new Error('MISSING_DEEP_LINK_SETTINGS') }
    if (!contentItems) { provDeepLinkingDebug('No content item passed.'); throw new Error('MISSING_CONTENT_ITEMS') }

    // If it's not an array, turns it into an array
    if (!Array.isArray(contentItems)) contentItems = [contentItems]

    // Gets platform
    const platform = await this.#getPlatform(idtoken.iss, idtoken.clientId, this.#ENCRYPTIONKEY, this.#Database)
    if (!platform) {
      provDeepLinkingDebug('Platform not found')
      throw new Error('PLATFORM_NOT_FOUND')
    }
    const platformActive = await platform.platformActive()
    if (!platformActive) throw new Error('PLATFORM_NOT_ACTIVATED')

    provDeepLinkingDebug('Building basic JWT body')
    // Builds basic jwt body
    const jwtBody: Record<string, unknown> = {
      iss: await platform.platformClientId(),
      aud: idtoken.iss,
      nonce: encodeURIComponent([...Array(25)].map(_ => (Math.random() * 36 | 0).toString(36)).join('')),
      'https://purl.imsglobal.org/spec/lti/claim/deployment_id': idtoken.deploymentId,
      'https://purl.imsglobal.org/spec/lti/claim/message_type': 'LtiDeepLinkingResponse',
      'https://purl.imsglobal.org/spec/lti/claim/version': '1.3.0'
    }

    // Adding messaging options
    if (options) {
      if (options.message) jwtBody['https://purl.imsglobal.org/spec/lti-dl/claim/msg'] = options.message
      if (options.errMessage || options.errmessage) jwtBody['https://purl.imsglobal.org/spec/lti-dl/claim/errormsg '] = options.errMessage || options.errmessage
      if (options.log) jwtBody['https://purl.imsglobal.org/spec/lti-dl/claim/log'] = options.log
      if (options.errLog || options.errlog) jwtBody['https://purl.imsglobal.org/spec/lti-dl/claim/errorlog'] = options.errLog || options.errlog
    }

    // Adding Data claim if it exists in initial request
    if (idtoken.platformContext.deepLinkingSettings.data) jwtBody['https://purl.imsglobal.org/spec/lti-dl/claim/data'] = idtoken.platformContext.deepLinkingSettings.data

    provDeepLinkingDebug('Sanitizing content item array based on the platform\'s requirements:')
    const selectedContentItems: any[] = []

    const acceptedTypes: string[] = idtoken.platformContext.deepLinkingSettings.accept_types
    const acceptMultiple = !(idtoken.platformContext.deepLinkingSettings.accept_multiple === 'false' || idtoken.platformContext.deepLinkingSettings.accept_multiple === false)

    provDeepLinkingDebug('Accepted Types: ' + acceptedTypes)
    provDeepLinkingDebug('Accepts Mutiple: ' + acceptMultiple)

    provDeepLinkingDebug('Received content items: ')
    provDeepLinkingDebug(contentItems)

    for (const contentItem of contentItems) {
      if (!acceptedTypes.includes(contentItem.type)) continue
      selectedContentItems.push(contentItem)
      if (!acceptMultiple) break
    }
    provDeepLinkingDebug('Content items to be sent: ')
    provDeepLinkingDebug(selectedContentItems)
    jwtBody['https://purl.imsglobal.org/spec/lti-dl/claim/content_items'] = selectedContentItems

    const message = jwt.sign(jwtBody, await platform.platformPrivateKey(), { algorithm: 'RS256', expiresIn: 60, keyid: await platform.platformKid() })
    return message
  }
}

export = DeepLinking
