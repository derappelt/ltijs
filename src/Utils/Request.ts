/* Handle Requests */

interface LoginRequest {
  client_id?: string
  target_link_uri: string
  login_hint: string
  lti_message_hint?: string
  lti_deployment_id?: string
}

interface LoginQuery {
  response_type: string
  response_mode: string
  id_token_signed_response_alg: string
  scope: string
  client_id: string
  redirect_uri: string
  login_hint: string
  nonce: string
  prompt: string
  state: string
  lti_message_hint?: string
  lti_deployment_id?: string
}

class Request {
  /**
   * @description Handles the Lti 1.3 initial login flow (OIDC protocol).
   * @param {object} request - Login request object sent by consumer.
   * @param {object} platform - Platform Object.
   * @param {String} state - State parameter, used to validate the response.
   */
  static async ltiAdvantageLogin (request: LoginRequest, platform: any, state: string): Promise<LoginQuery> {
    const query: LoginQuery = {
      response_type: 'id_token',
      response_mode: 'form_post',
      id_token_signed_response_alg: 'RS256',
      scope: 'openid',
      client_id: request.client_id || await platform.platformClientId(),
      redirect_uri: request.target_link_uri,
      login_hint: request.login_hint,
      nonce: encodeURIComponent([...Array(25)].map(_ => (Math.random() * 36 | 0).toString(36)).join('')),
      prompt: 'none',
      state
    }
    if (request.lti_message_hint) query.lti_message_hint = request.lti_message_hint
    if (request.lti_deployment_id) query.lti_deployment_id = request.lti_deployment_id

    return query
  }
}

export = Request
