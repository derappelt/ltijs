interface LoginRequest {
    client_id?: string;
    target_link_uri: string;
    login_hint: string;
    lti_message_hint?: string;
    lti_deployment_id?: string;
}
interface LoginQuery {
    response_type: string;
    response_mode: string;
    id_token_signed_response_alg: string;
    scope: string;
    client_id: string;
    redirect_uri: string;
    login_hint: string;
    nonce: string;
    prompt: string;
    state: string;
    lti_message_hint?: string;
    lti_deployment_id?: string;
}
declare class Request {
    /**
     * @description Handles the Lti 1.3 initial login flow (OIDC protocol).
     * @param {object} request - Login request object sent by consumer.
     * @param {object} platform - Platform Object.
     * @param {String} state - State parameter, used to validate the response.
     */
    static ltiAdvantageLogin(request: LoginRequest, platform: any, state: string): Promise<LoginQuery>;
}
export = Request;
//# sourceMappingURL=Request.d.ts.map