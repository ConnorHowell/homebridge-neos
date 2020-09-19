import { Logger } from 'homebridge';
import axios, { AxiosRequestConfig } from 'axios';
import { AuthenticationError } from './errors';

export type NeosDeviceType = 'noon.home.alarm' | 'neos.smartcam' | 'neos.smartcam.contact' | 'neos.smartcam.motion';

export type NeosDevice = {
    health: string,
    name: string,
    id: string,
    thing_type: NeosDeviceType
}

type DeviceQueryPayload= {
    health: string
}

class Session {
    private expiresOn!: number;

    constructor(private _accessToken: string, private _refreshToken: string, private expiresIn: number, private homeId: number) {
        this.resetToken(_accessToken, _refreshToken, expiresIn);
    }

    public get accessToken(): string {
        return this._accessToken;
    }

    public get home_id(): number {
        return this.homeId;
    }

    public get refreshToken(): string {
        return this._refreshToken;
    }

    public resetToken(accessToken, refreshToken, expiresIn): void {
        this._accessToken = accessToken;
        this._refreshToken = refreshToken;
        this.expiresOn = Session.getCurrentEpoch() + expiresIn - 100; // subtract 100 ticks to expire token before it actually does
    }

    public hasToken(): boolean {
        return !!this._accessToken;
    }

    public isTokenExpired(): boolean {
        return this.expiresOn < Session.getCurrentEpoch();
    }

    public hasValidToken(): boolean {
        return this.hasToken() && !this.isTokenExpired();
    }

    private static getCurrentEpoch(): number {
        return Math.round((new Date()).getTime() / 1000);
    }
}

export class NeosAPI {
    private session: Session | undefined;
    private baseUrl = 'https://production.neos.co.uk';

    constructor(
        private username: string,
        private password: string,
        private client_id: string,
        private client_secret: string,
        private log?: Logger) {
    }

    public async getAllDeviceStates(): Promise<NeosDevice[] | undefined> {
        return this.discoverDevices();
    }

    public async discoverDevices(): Promise<NeosDevice[] | undefined> {
        if (!this.session?.hasValidToken()) {
            throw new Error('No valid token');
        }

        const { data } = await this.sendRequest(
            `/api/customer_app/homes/${this.session.home_id}/things/`,
            null,
            'GET',
        );

        if (!data.error) {
            return data;
        } else {
            throw new Error(data.error);
        }
    }

    public async getDeviceState<T>(deviceId: string): Promise<T> {
        if (!this.session?.hasValidToken()) {
            throw new Error('No valid token');
        }

        const { data } = await this.sendRequest(
            `/api/customer_app/homes/${this.session.home_id}/things/${deviceId}`,
            null,
            'GET',
        );

        if (!data.error) {
            return data;
        } else {
            throw new Error(data.error);
        }
    }

    public async getOrRefreshToken(): Promise<Session | undefined> {
        if (!this.session?.hasToken()) {
            this.log?.debug('Requesting new token');
            // No token, lets get a token from the API
            if (!this.username) {
                throw new AuthenticationError('No username configured');
            }
            if (!this.password) {
                throw new AuthenticationError('No password configured');
            }

            const form = {
                username: this.username,
                password: this.password,
                client_id: this.client_id,
                client_secret: this.client_secret,
                grant_type: 'password',
            };

            const { data } = await
                axios({
                    url: '/oauth/token',
                    baseURL: this.baseUrl,
                    method: 'POST',
                    data: form
                });
            if (data.responseStatus === 'error') {
                throw new AuthenticationError(data.error_description);
            } else {
                const home = await axios({
                    url: '/api/customer_app/homes',
                    baseURL: this.baseUrl,
                    method: 'GET',
                    headers: {
                        'api-version': 'application/vnd.noon.v2',
                        'Authorization': `Bearer ${data.access_token}`
                    },
                });
                if(home) {
                    if(home.data.message == 'Unauthorised') throw new AuthenticationError(home.data.message);
                    this.session = new Session(
                        data.access_token,
                        data.refresh_token,
                        data.expires_in,
                        home.data[0].id
                    );
    
                    return this.session;
                }
                
            }

        } else {
            this.log?.debug('Refreshing token');
            if (this.session.isTokenExpired()) {
                // Refresh token
                const form = {
                    refresh_token: this.session.refreshToken,
                    client_id: this.client_id,
                    client_secret: this.client_secret,
                    grant_type: 'refresh_token',
                }
                const { data } = await axios({
                    url: '/oauth/token',
                    baseURL: this.baseUrl,
                    method: 'POST',
                    data: form
                });
                if (data.responseStatus === 'error') {
                    throw new AuthenticationError(data.error_description);
                } else {
                    const home = await axios({
                        url: '/api/customer_app/homes',
                        baseURL: this.baseUrl,
                        method: 'GET',
                        headers: {
                            'api-version': 'application/vnd.noon.v2',
                            'Authorization': `Bearer ${data.access_token}`
                        },
                    });
                    if(home) {
                        if(home.data.message == 'Unauthorised') throw new AuthenticationError(home.data.message);
                        this.session = new Session(
                            data.access_token,
                            data.refresh_token,
                            data.expires_in,
                            home.data[0].id
                        );
        
                        return this.session;
                    }
                }
            }
        }
    }

    /*
       * --------------------------------------
       * HTTP methods
      */

    public async sendRequest
        (url: AxiosRequestConfig['url'], data: AxiosRequestConfig['data'], method: AxiosRequestConfig['method']) {
        this.log?.debug('Sending HTTP %s request to %s', method, url);
        const response = await axios({
            headers: {
                'api-version': 'application/vnd.noon.v2',
                'Authorization': `Bearer ${this.session?.accessToken}`
            },
            baseURL: this.baseUrl,
            url,
            data,
            method,
        });

        return { data: response.data };
    }
}