/**
 * Reference "identitytoolkit" APIs Here:
 * https://cloud.google.com/identity-platform/docs/reference/rest/v1/accounts
 */

/**
 * @param {Object} config Object for specifying the configurations.
 * @param {String} config.apiKey Firebase API key.
 * @param {Array.<String|Object>} config.providers Array of providers in string/object format.
 * @param {String} config.redirectURL URL used by OAuth providers to redirect after successful sign-in.
 */
'use strict';

const CONSTANTS = Object.freeze({ USER_STORAGE_KEY_PREFIX: "Auth:User", SESSION_ID_STORAGE_KEY_PREFIX: "Auth:SessionId" });

export default class Auth {
    constructor({ name = 'default', apiKey, providers, redirectURL }) {
        if (!apiKey) throw Error('The argument "apiKey" is required.');
        if (!providers) throw Error('The argument "apiKey" is required.');
        if (!Array.isArray(providers)) throw Error('The argument "providers" must be an array.');
        if (!redirectURL) throw Error('The argument "redirectURL" is required.');

        this.listeners = [];
        this.user = JSON.parse(localStorage.getItem(`${CONSTANTS.USER_STORAGE_KEY_PREFIX}:${apiKey}:${name}`));
        Object.assign(this, { name, apiKey, redirectURL, providers: {} });

        for (let options of providers) {
            const { name, scope } = typeof options === 'string' ? { name: options } : options;
            this.providers[name] = scope;
        }

        if (this.user) {
            this.triggerCallbacks();
            this.fetchUserDetails();
        }
    }

    addListener(callback) {
        this.listeners.push(callback);
        if (!this.user) callback(null);
        return () => (this.listeners = this.listeners.filter(fn => fn !== callback));
    }

    triggerCallbacks() {
        this.listeners.forEach(callback => callback(this.user));
    }

    persistUser(userDetails) {
        localStorage.setItem(`${CONSTANTS.USER_STORAGE_KEY_PREFIX}:${this.apiKey}:${this.name}`, JSON.stringify(userDetails));
        this.user = userDetails;
        this.triggerCallbacks();
    }

    async refreshToken() {
        if (!this.user || !this.user.tokenDetails || (Date.now() < this.user.tokenDetails.expiresIn)) return;
        if (this.refreshTokenRequest) return await this.refreshTokenRequest;

        try {
            this.refreshTokenRequest = this.request('token', {
                grant_type: 'refresh_token',
                refresh_token: this.user.tokenDetails.refreshToken
            }).then((resp) => {
                const { id_token: idToken, refresh_token: refreshToken, expires_in: expiresIn } = resp;
                this.persistUser({
                    ...this.user,
                    tokenDetails: { idToken, refreshToken, expiresIn: this.getTokenTimeout(expiresIn) }
                });
            });
        } catch (error) {
            this.refreshTokenRequest = null;
            throw error;
        }
    }

    async signInWithProvider(options) {
        // Sign in using OAuth provider.
        // Redirect the page to OAuth provider's login interface.
        // On successful sign-in, Redirect back to configured "redirectURL".

        const { provider, context } = typeof options === 'string' ? { provider: options } : options;

        if (!provider) throw Error(`The provider argument is not specified`);

        if (!Object.keys(this.providers).includes(provider))
            throw Error(`Provider "${provider}" is not configured with this "Auth" instance.`);

        const { authUri, sessionId } = await this.request('createAuthUri', {
            providerId: provider,
            authFlowType: 'CODE_FLOW',
            continueUri: this.redirectURL,
            oauthScope: this.providers[provider],
            context
        });

        sessionStorage.setItem(`${CONSTANTS.SESSION_ID_STORAGE_KEY_PREFIX}:${this.apiKey}:${this.name}`, sessionId);
        location.href = authUri; // Redirects to OAuth provider's login interface.
    }

    async handlePostSignInRedirect() {
        // After OAuth provider successfully authenticates user, it redirects to url configured with "redirectURL"
        // So this function needs to be called in the controller invoked for the redirected url".
        if (!location.href.match(/[&?]code=/)) return;
        const sessionId = sessionStorage.getItem(`${CONSTANTS.SESSION_ID_STORAGE_KEY_PREFIX}:${this.apiKey}:${this.name}`);

        const { idToken, refreshToken, expiresIn, context } = await this.request('signInWithIdp', {
            sessionId,
            requestUri: location.href,
            returnSecureToken: true
        });

        await this.fetchUserDetails({ idToken, refreshToken, expiresIn: this.getTokenTimeout(expiresIn) });
        history.replaceState(null, null, location.origin + location.pathname); // URL Cleanup

        return context;
    }

    async fetchUserDetails(tokenDetails) {
        await this.refreshToken();
        const { idToken } = tokenDetails || this.user.tokenDetails;
        const userDetails = (await this.request('lookup', { idToken })).users[0];
        delete userDetails.kind;
        userDetails.tokenDetails = tokenDetails || this.user.tokenDetails;
        this.persistUser(userDetails);
    }

    signOut() {
        localStorage.removeItem(`${CONSTANTS.USER_STORAGE_KEY_PREFIX}:${this.apiKey}:${this.name}`);
        this.user = null;
        this.triggerCallbacks();
    }

    async request(method, payload) {
        const url = method === 'token'
            ? `https://securetoken.googleapis.com/v1/token?key=${this.apiKey}`
            : `https://identitytoolkit.googleapis.com/v1/accounts:${method}?key=${this.apiKey}`;

        return fetch(url, {
            method: 'POST',
            body: typeof payload === 'string' ? payload : JSON.stringify(payload)
        }).then(async response => {
            const payload = await response.json();
            if (!response.ok) throw Error(payload.error.message); // Something went wrong
            return payload;
        });
    }

    getTokenTimeout(duration) {
        return Date.now() + duration * 1000;
    }
}
