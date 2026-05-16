/* Provider Assignment and Grade Service */

import got from '../../Utils/Http'
import parseLink from 'parse-link-header'
import debug from 'debug'
import { GetPlatformFn, AccessTokenResponse } from '../../types/shared'

const provGradeServiceDebug = debug('provider:gradeService')

interface LineItemOptions {
  resourceLinkId?: boolean
  resourceId?: string
  tag?: string
  limit?: number
  id?: string
  label?: string
  url?: string
}

interface LineItemsResult {
  lineItems: any[]
  next?: string
  prev?: string
  first?: string
  last?: string
}

interface ScoreOptions {
  userId?: string
  limit?: number
  url?: string
}

interface ScoresResult {
  scores: any[]
  next?: string
  prev?: string
  first?: string
  last?: string
}

class Grade {
  #getPlatform: GetPlatformFn

  #ENCRYPTIONKEY = ''

  #Database: any

  constructor (getPlatform: GetPlatformFn, ENCRYPTIONKEY: string, Database: any) {
    this.#getPlatform = getPlatform
    this.#ENCRYPTIONKEY = ENCRYPTIONKEY
    this.#Database = Database
  }

  /**
   * @description Gets lineitems from a given platform
   */
  async getLineItems (idtoken: any, options?: LineItemOptions, accessToken?: AccessTokenResponse): Promise<LineItemsResult> {
    if (!idtoken) { provGradeServiceDebug('Missing IdToken object.'); throw new Error('MISSING_ID_TOKEN') }
    provGradeServiceDebug('Target platform: ' + idtoken.iss)

    if (!accessToken) {
      const platform = await this.#getPlatform(idtoken.iss, idtoken.clientId, this.#ENCRYPTIONKEY, this.#Database) // Remove and use DB instead

      /* istanbul ignore next */
      if (!platform) {
        provGradeServiceDebug('Platform not found')
        throw new Error('PLATFORM_NOT_FOUND')
      }
      const platformActive = await platform.platformActive()
      if (!platformActive) throw new Error('PLATFORM_NOT_ACTIVATED')

      provGradeServiceDebug('Attempting to retrieve platform access_token for [' + idtoken.iss + ']')

      accessToken = await platform.platformAccessToken('https://purl.imsglobal.org/spec/lti-ags/scope/lineitem.readonly')
      provGradeServiceDebug('Access_token retrieved for [' + idtoken.iss + ']')
    }

    const result: LineItemsResult = { lineItems: [] }
    let response

    if (options && options.url) {
      provGradeServiceDebug('Requesting line items from: ' + options.url)
      response = await got.get(options.url, { headers: { Authorization: accessToken!.token_type + ' ' + accessToken!.access_token, Accept: 'application/vnd.ims.lis.v2.lineitemcontainer+json' } })
    } else {
      let lineitemsEndpoint: string = idtoken.platformContext.endpoint.lineitems
      let query: Array<[string, string]> = []
      if (lineitemsEndpoint.indexOf('?') !== -1) {
        query = Array.from(new URLSearchParams(lineitemsEndpoint.split('?')[1]))
        lineitemsEndpoint = lineitemsEndpoint.split('?')[0]
      }

      const queryParamsArr: Array<[string, string]> = [...query]
      if (options) {
        if (options.resourceLinkId) queryParamsArr.push(['resource_link_id', idtoken.platformContext.resource.id])
        if (options.limit && !options.id && !options.label) queryParamsArr.push(['limit', String(options.limit)])
        if (options.tag) queryParamsArr.push(['tag', options.tag])
        if (options.resourceId) queryParamsArr.push(['resource_id', options.resourceId])
      }
      const queryParams = new URLSearchParams(queryParamsArr)
      provGradeServiceDebug('Requesting line items from: ' + lineitemsEndpoint)
      response = await got.get(lineitemsEndpoint, { searchParams: queryParams, headers: { Authorization: accessToken!.token_type + ' ' + accessToken!.access_token, Accept: 'application/vnd.ims.lis.v2.lineitemcontainer+json' } })
    }

    const headers = response.headers
    let lineItems: any[] = JSON.parse(response.body)

    // Parsing link headers
    const parsedLinks = parseLink(headers.link as string)

    if (parsedLinks) {
      if (parsedLinks.next) result.next = parsedLinks.next.url
      if (parsedLinks.prev) result.prev = parsedLinks.prev.url
      if (parsedLinks.first) result.first = parsedLinks.first.url
      if (parsedLinks.last) result.last = parsedLinks.last.url
    }

    // Applying special filters
    if (options && options.id) lineItems = lineItems.filter(lineitem => { return lineitem.id === options.id })
    if (options && options.label) lineItems = lineItems.filter(lineitem => { return lineitem.label === options.label })
    if (options && options.limit && (options.id || options.label) && options.limit < lineItems.length) lineItems = lineItems.slice(0, options.limit)

    result.lineItems = lineItems
    return result
  }

  /**
   * @description Creates a new lineItem for the given context
   */
  async createLineItem (idtoken: any, lineItem: any, options?: LineItemOptions, accessToken?: AccessTokenResponse): Promise<any> {
    // Validating lineItem
    if (!idtoken) { provGradeServiceDebug('Missing IdToken object.'); throw new Error('MISSING_ID_TOKEN') }
    if (!lineItem) { provGradeServiceDebug('Line item object missing.'); throw new Error('MISSING_LINE_ITEM') }

    if (options && options.resourceLinkId) lineItem.resourceLinkId = idtoken.platformContext.resource.id

    provGradeServiceDebug('Target platform: ' + idtoken.iss)

    if (!accessToken) {
      const platform = await this.#getPlatform(idtoken.iss, idtoken.clientId, this.#ENCRYPTIONKEY, this.#Database)

      /* istanbul ignore next */
      if (!platform) {
        provGradeServiceDebug('Platform not found')
        throw new Error('PLATFORM_NOT_FOUND')
      }
      const platformActive = await platform.platformActive()
      if (!platformActive) throw new Error('PLATFORM_NOT_ACTIVATED')

      provGradeServiceDebug('Attempting to retrieve platform access_token for [' + idtoken.iss + ']')

      accessToken = await platform.platformAccessToken('https://purl.imsglobal.org/spec/lti-ags/scope/lineitem')
      provGradeServiceDebug('Access_token retrieved for [' + idtoken.iss + ']')
    }
    const lineitemsEndpoint: string = idtoken.platformContext.endpoint.lineitems

    provGradeServiceDebug('Creating Line item: ')
    provGradeServiceDebug(lineItem)

    const newLineItem = await got.post(lineitemsEndpoint, { headers: { Authorization: accessToken!.token_type + ' ' + accessToken!.access_token, 'Content-Type': 'application/vnd.ims.lis.v2.lineitem+json' }, json: lineItem }).json()

    provGradeServiceDebug('Line item successfully created')
    return newLineItem
  }

  /**
   * @description Gets LineItem by the ID
   */
  async getLineItemById (idtoken: any, lineItemId: string, accessToken?: AccessTokenResponse): Promise<any> {
    if (!idtoken) { provGradeServiceDebug('Missing IdToken object.'); throw new Error('MISSING_ID_TOKEN') }
    if (!lineItemId) { provGradeServiceDebug('Missing lineItemID.'); throw new Error('MISSING_LINEITEM_ID') }

    provGradeServiceDebug('Target platform: ' + idtoken.iss)

    if (!accessToken) {
      const platform = await this.#getPlatform(idtoken.iss, idtoken.clientId, this.#ENCRYPTIONKEY, this.#Database) // Remove and use DB instead

      /* istanbul ignore next */
      if (!platform) {
        provGradeServiceDebug('Platform not found')
        throw new Error('PLATFORM_NOT_FOUND')
      }
      const platformActive = await platform.platformActive()
      if (!platformActive) throw new Error('PLATFORM_NOT_ACTIVATED')

      provGradeServiceDebug('Attempting to retrieve platform access_token for [' + idtoken.iss + ']')

      accessToken = await platform.platformAccessToken('https://purl.imsglobal.org/spec/lti-ags/scope/lineitem.readonly')
      provGradeServiceDebug('Access_token retrieved for [' + idtoken.iss + ']')
    }

    const lineitemUrl = lineItemId
    provGradeServiceDebug('Retrieving: ' + lineitemUrl)
    let response: any = await got.get(lineitemUrl, { headers: { Authorization: accessToken!.token_type + ' ' + accessToken!.access_token } })
    response = JSON.parse(response.body)
    provGradeServiceDebug('LineItem sucessfully retrieved')
    return response
  }

  /**
   * @description Updates LineItem by the ID
   */
  async updateLineItemById (idtoken: any, lineItemId: string, lineItem: any): Promise<any> {
    if (!idtoken) { provGradeServiceDebug('Missing IdToken object.'); throw new Error('MISSING_ID_TOKEN') }
    if (!lineItemId) { provGradeServiceDebug('Missing lineItemID.'); throw new Error('MISSING_LINEITEM_ID') }
    if (!lineItem) { provGradeServiceDebug('Missing lineItem object.'); throw new Error('MISSING_LINEITEM') }

    provGradeServiceDebug('Target platform: ' + idtoken.iss)

    const platform = await this.#getPlatform(idtoken.iss, idtoken.clientId, this.#ENCRYPTIONKEY, this.#Database)

    /* istanbul ignore next */
    if (!platform) {
      provGradeServiceDebug('Platform not found')
      throw new Error('PLATFORM_NOT_FOUND')
    }
    const platformActive = await platform.platformActive()
    if (!platformActive) throw new Error('PLATFORM_NOT_ACTIVATED')

    provGradeServiceDebug('Attempting to retrieve platform access_token for [' + idtoken.iss + ']')
    const accessToken = await platform.platformAccessToken('https://purl.imsglobal.org/spec/lti-ags/scope/lineitem')
    provGradeServiceDebug('Access_token retrieved for [' + idtoken.iss + ']')

    const lineitemUrl = lineItemId
    provGradeServiceDebug('Updating: ' + lineitemUrl)
    let response: any = await got.put(lineitemUrl, { json: lineItem, headers: { Authorization: accessToken.token_type + ' ' + accessToken.access_token, 'Content-Type': 'application/vnd.ims.lis.v2.lineitem+json' } })
    response = JSON.parse(response.body)
    provGradeServiceDebug('LineItem sucessfully updated')
    return response
  }

  /**
   * @description Deletes LineItem by the ID
   */
  async deleteLineItemById (idtoken: any, lineItemId: string): Promise<boolean> {
    if (!idtoken) { provGradeServiceDebug('Missing IdToken object.'); throw new Error('MISSING_ID_TOKEN') }
    if (!lineItemId) { provGradeServiceDebug('Missing lineItemID.'); throw new Error('MISSING_LINEITEM_ID') }

    provGradeServiceDebug('Target platform: ' + idtoken.iss)

    const platform = await this.#getPlatform(idtoken.iss, idtoken.clientId, this.#ENCRYPTIONKEY, this.#Database)

    /* istanbul ignore next */
    if (!platform) {
      provGradeServiceDebug('Platform not found')
      throw new Error('PLATFORM_NOT_FOUND')
    }
    const platformActive = await platform.platformActive()
    if (!platformActive) throw new Error('PLATFORM_NOT_ACTIVATED')

    provGradeServiceDebug('Attempting to retrieve platform access_token for [' + idtoken.iss + ']')
    const accessToken = await platform.platformAccessToken('https://purl.imsglobal.org/spec/lti-ags/scope/lineitem')
    provGradeServiceDebug('Access_token retrieved for [' + idtoken.iss + ']')

    const lineitemUrl = lineItemId
    provGradeServiceDebug('Deleting: ' + lineitemUrl)
    await got.delete(lineitemUrl, { headers: { Authorization: accessToken.token_type + ' ' + accessToken.access_token } })
    provGradeServiceDebug('LineItem sucessfully deleted')
    return true
  }

  /**
   * @description Publishes a score or grade to a lineItem. Represents the Score Publish service described in the lti 1.3 specification.
   */
  async submitScore (idtoken: any, lineItemId: string, score: any): Promise<any> {
    if (!idtoken) { provGradeServiceDebug('Missing IdToken object.'); throw new Error('MISSING_ID_TOKEN') }
    if (!lineItemId) { provGradeServiceDebug('Missing lineItemID.'); throw new Error('MISSING_LINEITEM_ID') }
    if (!score) { provGradeServiceDebug('Score object missing.'); throw new Error('MISSING_SCORE') }
    provGradeServiceDebug('Target platform: ' + idtoken.iss)

    const platform = await this.#getPlatform(idtoken.iss, idtoken.clientId, this.#ENCRYPTIONKEY, this.#Database)

    /* istanbul ignore next */
    if (!platform) {
      provGradeServiceDebug('Platform not found')
      throw new Error('PLATFORM_NOT_FOUND')
    }
    const platformActive = await platform.platformActive()
    if (!platformActive) throw new Error('PLATFORM_NOT_ACTIVATED')

    const shouldFetchScoreMaximum = score.scoreGiven !== undefined && score.scoreMaximum === undefined
    const scopes = ['https://purl.imsglobal.org/spec/lti-ags/scope/score']
    if (shouldFetchScoreMaximum) {
      scopes.push('https://purl.imsglobal.org/spec/lti-ags/scope/lineitem')
    }

    provGradeServiceDebug('Attempting to retrieve platform access_token for [' + idtoken.iss + ']')
    const accessToken = await platform.platformAccessToken(scopes.join(' '))
    provGradeServiceDebug('Access_token retrieved for [' + idtoken.iss + ']')

    // Creating scores URL
    const lineitemUrl = lineItemId
    let scoreUrl = lineitemUrl + '/scores'
    if (lineitemUrl.indexOf('?') !== -1) {
      const query = lineitemUrl.split('?')[1]
      const url = lineitemUrl.split('?')[0]
      scoreUrl = url + '/scores?' + query
    }

    // Creating scoreMaximum if it is not present and scoreGiven exists
    if (shouldFetchScoreMaximum) {
      const lineItem = await this.getLineItemById(idtoken, lineItemId, accessToken)
      score.scoreMaximum = lineItem.scoreMaximum
    }

    // If no user is specified, sends the score to the user that originated request
    if (score.userId === undefined) score.userId = idtoken.user

    // Creating timestamp
    score.timestamp = new Date(Date.now()).toISOString()

    provGradeServiceDebug('Sending score to: ' + scoreUrl)
    provGradeServiceDebug(score)

    await got.post(scoreUrl, { headers: { Authorization: accessToken.token_type + ' ' + accessToken.access_token, 'Content-Type': 'application/vnd.ims.lis.v1.score+json' }, json: score })
    provGradeServiceDebug('Score successfully sent')
    return score
  }

  /**
   * @description Retrieves scores from a lineItem. Represents the Result service described in the lti 1.3 specification.
   */
  async getScores (idtoken: any, lineItemId: string, options?: ScoreOptions): Promise<ScoresResult> {
    if (!idtoken) { provGradeServiceDebug('Missing IdToken object.'); throw new Error('MISSING_ID_TOKEN') }
    if (!lineItemId) { provGradeServiceDebug('Missing lineItemID.'); throw new Error('MISSING_LINEITEM_ID') }

    provGradeServiceDebug('Target platform: ' + idtoken.iss)

    const platform = await this.#getPlatform(idtoken.iss, idtoken.clientId, this.#ENCRYPTIONKEY, this.#Database)

    /* istanbul ignore next */
    if (!platform) {
      provGradeServiceDebug('Platform not found')
      throw new Error('PLATFORM_NOT_FOUND')
    }
    const platformActive = await platform.platformActive()
    if (!platformActive) throw new Error('PLATFORM_NOT_ACTIVATED')

    provGradeServiceDebug('Attempting to retrieve platform access_token for [' + idtoken.iss + ']')
    const accessToken = await platform.platformAccessToken('https://purl.imsglobal.org/spec/lti-ags/scope/lineitem.readonly https://purl.imsglobal.org/spec/lti-ags/scope/result.readonly')
    provGradeServiceDebug('Access_token retrieved for [' + idtoken.iss + ']')

    const result: ScoresResult = { scores: [] }
    let response

    if (options && options.url) {
      provGradeServiceDebug('Requesting scores from: ' + options.url)
      response = await got.get(options.url, { headers: { Authorization: accessToken.token_type + ' ' + accessToken.access_token, Accept: 'application/vnd.ims.lis.v2.resultcontainer+json' } })
    } else {
      // Creating results URL
      const lineitemUrl = lineItemId
      let query: Array<[string, string]> = []
      let resultsUrl = lineitemUrl + '/results'
      if (lineitemUrl.indexOf('?') !== -1) {
        query = Array.from(new URLSearchParams(lineitemUrl.split('?')[1]))
        const url = lineitemUrl.split('?')[0]
        resultsUrl = url + '/results'
      }

      // Creating query parameters
      const queryParams: Array<[string, string]> = []
      if (options) {
        if (options.userId) queryParams.push(['user_id', options.userId])
        if (options.limit) queryParams.push(['limit', String(options.limit)])
      }
      const searchParamsArr = [...queryParams, ...query]
      const searchParams = new URLSearchParams(searchParamsArr)

      provGradeServiceDebug('Requesting scores from: ' + resultsUrl)
      response = await got.get(resultsUrl, { searchParams, headers: { Authorization: accessToken.token_type + ' ' + accessToken.access_token, Accept: 'application/vnd.ims.lis.v2.resultcontainer+json' } })
    }

    const headers = response.headers
    result.scores = JSON.parse(response.body)

    // Parsing link headers
    const parsedLinks = parseLink(headers.link as string)

    if (parsedLinks) {
      if (parsedLinks.next) result.next = parsedLinks.next.url
      if (parsedLinks.prev) result.prev = parsedLinks.prev.url
      if (parsedLinks.first) result.first = parsedLinks.first.url
      if (parsedLinks.last) result.last = parsedLinks.last.url
    }

    return result
  }

  // Deprecated methods, these methods will be removed in version 6.0

  /* istanbul ignore next */
  /**
   * @deprecated
   */
  async deleteLineItems (idtoken: any, options?: LineItemOptions): Promise<{ success: any[], failure: any[] }> {
    if (!idtoken) { provGradeServiceDebug('Missing IdToken object.'); throw new Error('MISSING_ID_TOKEN') }

    provGradeServiceDebug('Target platform: ' + idtoken.iss)

    const platform = await this.#getPlatform(idtoken.iss, idtoken.clientId, this.#ENCRYPTIONKEY, this.#Database)

    if (!platform) {
      provGradeServiceDebug('Platform not found')
      throw new Error('PLATFORM_NOT_FOUND')
    }
    const platformActive = await platform.platformActive()
    if (!platformActive) throw new Error('PLATFORM_NOT_ACTIVATED')

    provGradeServiceDebug('Attempting to retrieve platform access_token for [' + idtoken.iss + ']')
    const accessToken = await platform.platformAccessToken('https://purl.imsglobal.org/spec/lti-ags/scope/lineitem')
    provGradeServiceDebug('Access_token retrieved for [' + idtoken.iss + ']')

    const response = await this.getLineItems(idtoken, options, accessToken)
    const lineItems = response.lineItems

    const result: { success: any[], failure: any[] } = { success: [], failure: [] }
    for (const lineitem of lineItems) {
      try {
        const lineitemUrl = lineitem.id

        provGradeServiceDebug('Deleting: ' + lineitemUrl)
        await got.delete(lineitemUrl, { headers: { Authorization: accessToken.token_type + ' ' + accessToken.access_token } })
        provGradeServiceDebug('LineItem sucessfully deleted')
        result.success.push({ lineitem: lineitemUrl })
      } catch (err) {
        provGradeServiceDebug(err as any)
        result.failure.push({ lineitem: lineitem.id, error: (err as Error).message })
        continue
      }
    }
    return result
  }

  /* istanbul ignore next */
  /**
   * @deprecated
   */
  async scorePublish (idtoken: any, score: any, options?: LineItemOptions & { autoCreate?: any, userId?: string }): Promise<{ success: any[], failure: any[] }> {
    if (!idtoken) { provGradeServiceDebug('Missing IdToken object.'); throw new Error('MISSING_ID_TOKEN') }
    if (!score) { provGradeServiceDebug('Score object missing.'); throw new Error('MISSING_SCORE') }
    provGradeServiceDebug('Target platform: ' + idtoken.iss)

    const platform = await this.#getPlatform(idtoken.iss, idtoken.clientId, this.#ENCRYPTIONKEY, this.#Database)

    if (!platform) {
      provGradeServiceDebug('Platform not found')
      throw new Error('PLATFORM_NOT_FOUND')
    }
    const platformActive = await platform.platformActive()
    if (!platformActive) throw new Error('PLATFORM_NOT_ACTIVATED')

    provGradeServiceDebug('Attempting to retrieve platform access_token for [' + idtoken.iss + ']')

    const accessToken = await platform.platformAccessToken('https://purl.imsglobal.org/spec/lti-ags/scope/lineitem https://purl.imsglobal.org/spec/lti-ags/scope/score')
    provGradeServiceDebug('Access_token retrieved for [' + idtoken.iss + ']')

    if (options) {
      if (options.resourceLinkId === false) options.resourceLinkId = false
      else options.resourceLinkId = true
    } else options = { resourceLinkId: true }

    let lineItems: any[]
    if (options && options.id) {
      try {
        lineItems = [await this.getLineItemById(idtoken, options.id, accessToken)]
      } catch {
        lineItems = []
      }
    } else {
      const response = await this.getLineItems(idtoken, options, accessToken)
      lineItems = response.lineItems
    }

    const result: { success: any[], failure: any[] } = { success: [], failure: [] }

    if (lineItems.length === 0) {
      if (options && options.autoCreate) {
        provGradeServiceDebug('No line item found, creating new lite item automatically')
        lineItems.push(await this.createLineItem(idtoken, options.autoCreate, { resourceLinkId: options.resourceLinkId }, accessToken))
      } else provGradeServiceDebug('No available line item found')
    }

    for (const lineitem of lineItems) {
      try {
        const lineitemUrl = lineitem.id
        let scoreUrl = lineitemUrl + '/scores'

        if (lineitemUrl.indexOf('?') !== -1) {
          const query = lineitemUrl.split('?')[1]
          const url = lineitemUrl.split('?')[0]
          scoreUrl = url + '/scores?' + query
        }

        provGradeServiceDebug('Sending score to: ' + scoreUrl)

        if (options && options.userId) score.userId = options.userId
        else score.userId = idtoken.user

        score.timestamp = new Date(Date.now()).toISOString()
        if (score.scoreGiven) score.scoreMaximum = lineitem.scoreMaximum
        provGradeServiceDebug(score)

        await got.post(scoreUrl, { headers: { Authorization: accessToken.token_type + ' ' + accessToken.access_token, 'Content-Type': 'application/vnd.ims.lis.v1.score+json' }, json: score })
        provGradeServiceDebug('Score successfully sent')
        result.success.push({ lineitem: lineitemUrl })
      } catch (err) {
        provGradeServiceDebug(err as any)
        result.failure.push({ lineitem: lineitem.id, error: (err as Error).message })
        continue
      }
    }
    return result
  }

  /* istanbul ignore next */
  /**
   * @deprecated
   */
  async result (idtoken: any, options?: LineItemOptions & { userId?: string }): Promise<any[]> {
    if (!idtoken) { provGradeServiceDebug('Missing IdToken object.'); throw new Error('MISSING_ID_TOKEN') }

    provGradeServiceDebug('Target platform: ' + idtoken.iss)

    const platform = await this.#getPlatform(idtoken.iss, idtoken.clientId, this.#ENCRYPTIONKEY, this.#Database)

    if (!platform) {
      provGradeServiceDebug('Platform not found')
      throw new Error('PLATFORM_NOT_FOUND')
    }
    const platformActive = await platform.platformActive()
    if (!platformActive) throw new Error('PLATFORM_NOT_ACTIVATED')

    provGradeServiceDebug('Attempting to retrieve platform access_token for [' + idtoken.iss + ']')
    const accessToken = await platform.platformAccessToken('https://purl.imsglobal.org/spec/lti-ags/scope/lineitem.readonly https://purl.imsglobal.org/spec/lti-ags/scope/result.readonly')
    provGradeServiceDebug('Access_token retrieved for [' + idtoken.iss + ']')

    let limit: number | false = false

    if (options) {
      if (options.resourceLinkId === false) options.resourceLinkId = false
      else options.resourceLinkId = true

      if (options.limit) {
        limit = options.limit
        options.limit = undefined
      }
    } else options = { resourceLinkId: true }

    let lineItems: any[]
    if (options && options.id) {
      try {
        lineItems = [await this.getLineItemById(idtoken, options.id, accessToken)]
      } catch {
        lineItems = []
      }
    } else {
      const response = await this.getLineItems(idtoken, options, accessToken)
      lineItems = response.lineItems
    }

    const queryParams: Array<[string, string]> = []
    if (options) {
      if (options.userId) queryParams.push(['user_id', options.userId])
      if (limit) queryParams.push(['limit', String(limit)])
    }

    const resultsArray: any[] = []

    for (const lineitem of lineItems) {
      try {
        const lineitemUrl = lineitem.id
        let query: Array<[string, string]> = []
        let resultsUrl = lineitemUrl + '/results'

        if (lineitemUrl.indexOf('?') !== -1) {
          query = Array.from(new URLSearchParams(lineitemUrl.split('?')[1]))
          const url = lineitemUrl.split('?')[0]
          resultsUrl = url + '/results'
        }
        const searchParamsArr = [...queryParams, ...query]
        const searchParams = new URLSearchParams(searchParamsArr)
        provGradeServiceDebug('Requesting results from: ' + resultsUrl)
        const results = await got.get(resultsUrl, { searchParams, headers: { Authorization: accessToken.token_type + ' ' + accessToken.access_token, Accept: 'application/vnd.ims.lis.v2.resultcontainer+json' } }).json()

        resultsArray.push({
          lineitem: lineitem.id,
          results
        })
      } catch (err) {
        provGradeServiceDebug((err as Error).message)
        resultsArray.push({
          lineitem: lineitem.id,
          error: (err as Error).message
        })
        continue
      }
    }
    return resultsArray
  }

  /* istanbul ignore next */
  /**
   * @deprecated
   */
  async GetLineItems (idtoken: any, options?: LineItemOptions, accessToken?: AccessTokenResponse): Promise<LineItemsResult> {
    console.log('Deprecation warning: GetLineItems() is now deprecated, use getLineItems() instead. GetLineItems() will be removed in the 6.0 release.')
    return this.getLineItems(idtoken, options, accessToken)
  }

  /* istanbul ignore next */
  /**
   * @deprecated
   */
  async CreateLineItem (idtoken: any, lineItem: any, options?: LineItemOptions, accessToken?: AccessTokenResponse): Promise<any> {
    console.log('Deprecation warning: CreateLineItem() is now deprecated, use createLineItem() instead. CreateLineItem() will be removed in the 6.0 release.')
    return this.createLineItem(idtoken, lineItem, options, accessToken)
  }

  /* istanbul ignore next */
  /**
   * @deprecated
   */
  async DeleteLineItems (idtoken: any, options?: LineItemOptions): Promise<{ success: any[], failure: any[] }> {
    console.log('Deprecation warning: DeleteLineItems() is now deprecated, use deleteLineItems() instead. DeleteLineItems() will be removed in the 6.0 release.')
    return this.deleteLineItems(idtoken, options)
  }

  /* istanbul ignore next */
  /**
   * @deprecated
   */
  async ScorePublish (idtoken: any, score: any, options?: LineItemOptions & { autoCreate?: any, userId?: string }): Promise<{ success: any[], failure: any[] }> {
    console.log('Deprecation warning: ScorePublish() is now deprecated, use scorePublish() instead. ScorePublish() will be removed in the 6.0 release.')
    return this.scorePublish(idtoken, score, options)
  }

  /* istanbul ignore next */
  /**
   * @deprecated
   */
  async Result (idtoken: any, options?: LineItemOptions & { userId?: string }): Promise<any[]> {
    console.log('Deprecation warning: Result() is now deprecated, use result() instead. Result() will be removed in the 6.0 release.')
    return this.result(idtoken, options)
  }
}

export = Grade
