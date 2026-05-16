/* Names and Roles Provisioning Service */

import got from '../../Utils/Http'
import parseLink from 'parse-link-header'
import debug from 'debug'
import { GetPlatformFn } from '../../types/shared'

const provNamesAndRolesServiceDebug = debug('provider:namesAndRolesService')

interface MembersOptions {
  role?: string
  limit?: number
  pages?: number | false
  url?: string
  resourceLinkId?: boolean
}

class NamesAndRoles {
  #getPlatform: GetPlatformFn

  #ENCRYPTIONKEY = ''

  #Database: any

  constructor (getPlatform: GetPlatformFn, ENCRYPTIONKEY: string, Database: any) {
    this.#getPlatform = getPlatform
    this.#ENCRYPTIONKEY = ENCRYPTIONKEY
    this.#Database = Database
  }

  /**
   * @description Retrieves members from platform.
   */
  async getMembers (idtoken: any, options?: MembersOptions): Promise<any> {
    if (!idtoken) { provNamesAndRolesServiceDebug('Missing IdToken object.'); throw new Error('MISSING_ID_TOKEN') }
    provNamesAndRolesServiceDebug('Attempting to retrieve memberships')
    provNamesAndRolesServiceDebug('Target platform: ' + idtoken.iss)

    const platform = await this.#getPlatform(idtoken.iss, idtoken.clientId, this.#ENCRYPTIONKEY, this.#Database)

    if (!platform) {
      provNamesAndRolesServiceDebug('Platform not found')
      throw new Error('PLATFORM_NOT_FOUND')
    }
    const platformActive = await platform.platformActive()
    if (!platformActive) throw new Error('PLATFORM_NOT_ACTIVATED')

    provNamesAndRolesServiceDebug('Attempting to retrieve platform access_token for [' + idtoken.iss + ']')
    const tokenRes = await platform.platformAccessToken('https://purl.imsglobal.org/spec/lti-nrps/scope/contextmembership.readonly')
    provNamesAndRolesServiceDebug('Access_token retrieved for [' + idtoken.iss + ']')

    let pages: number | false = 1 // Page limit
    let queryArr: Array<[string, string]> | false = []

    let next: string | false = idtoken.platformContext.namesRoles.context_memberships_url
    if (options) {
      if (options.pages || options.pages === false) {
        provNamesAndRolesServiceDebug('Maximum number of pages retrieved: ' + options.pages)
        pages = options.pages
      }
      if (options.url) {
        next = options.url
        queryArr = false
      } else {
        if (options.role) {
          provNamesAndRolesServiceDebug('Adding role parameter with value: ' + options.role)
          ;(queryArr as Array<[string, string]>).push(['role', options.role])
        }
        if (options.limit) {
          provNamesAndRolesServiceDebug('Adding limit parameter with value: ' + options.limit)
          ;(queryArr as Array<[string, string]>).push(['limit', String(options.limit)])
        }
        if (options.resourceLinkId) {
          provNamesAndRolesServiceDebug('Adding rlid parameter with value: ' + idtoken.platformContext.resource.id)
          ;(queryArr as Array<[string, string]>).push(['rlid', idtoken.platformContext.resource.id])
        }
      }
    }

    let query: URLSearchParams | false
    if (queryArr && queryArr.length > 0) query = new URLSearchParams(queryArr)
    else query = false

    let differences: string | undefined
    let result: any
    let curPage = 1

    do {
      if (pages && curPage > pages) {
        if (next) result.next = next
        break
      }
      let response
      provNamesAndRolesServiceDebug('Member pages found: ', curPage)
      provNamesAndRolesServiceDebug('Current member page: ', next)

      if (query && curPage === 1) response = await got.get(next as string, { searchParams: query, headers: { Authorization: tokenRes.token_type + ' ' + tokenRes.access_token, Accept: 'application/vnd.ims.lti-nrps.v2.membershipcontainer+json' } })
      else response = await got.get(next as string, { headers: { Authorization: tokenRes.token_type + ' ' + tokenRes.access_token, Accept: 'application/vnd.ims.lti-nrps.v2.membershipcontainer+json' } })

      const headers = response.headers
      const body = JSON.parse(response.body)

      if (!result) result = JSON.parse(JSON.stringify(body))
      else {
        result.members = [
          ...result.members,
          ...body.members
        ]
      }

      const parsedLinks = parseLink(headers.link as string)
      // Trying to find "rel=differences" header
      if (parsedLinks && parsedLinks.differences) differences = parsedLinks.differences.url
      // Trying to find "rel=next" header, indicating additional pages
      if (parsedLinks && parsedLinks.next) next = parsedLinks.next.url
      else next = false
      curPage++
    } while (next)

    if (differences) result.differences = differences
    provNamesAndRolesServiceDebug('Memberships retrieved')
    return result
  }
}

export = NamesAndRoles
