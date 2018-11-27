const request = require('request-promise-native');
const CryptoJS = require('crypto-js');

const get = (url, params, apiKey, apiSecret, passphrase, requestOptions) => {
    const paramKeys = Object.keys(params);
    let index = 0;
    let urlT = url;
    for (const key of paramKeys) {
        if (params[key] !== undefined && params[key] !== '') {
            if (index === 0) {
                urlT += `?${paramKeys[index]}=${params[key]}`;
            } else {
                urlT += `&${paramKeys[index]}=${params[key]}`;
            }
            index += 1;
        }
    }
    const timestamp = new Date().toISOString();
    const dirUrl = urlT.replace(/.*\/\/[^\/]*/, ''); // eslint-disable-line no-useless-escape
    const sign = CryptoJS.enc.Base64.stringify(CryptoJS.HmacSHA256(`${timestamp}GET${dirUrl}`, apiSecret));
    const options = {
        method: 'get',
        headers: {
            'OK-ACCESS-KEY': apiKey,
            'OK-ACCESS-SIGN': sign,
            'OK-ACCESS-TIMESTAMP': timestamp,
            'OK-ACCESS-PASSPHRASE': passphrase,
            Accept: 'application/json',
            'Content-Type': 'application/json'
        },
        json: true,
        timeout: 10000,
        ...requestOptions
    };

    return request(urlT, options);
};

const URL = 'https://www.okex.com/api';

module.exports = class OkexApi {
    constructor(apiKey, apiSecret, passphrase) {
        this.apiKey = apiKey;
        this.apiSecret = apiSecret;
        this.passphrase = passphrase;
    }

    async getBalances(requestOptions) {
        return get(`${URL}/spot/v3/accounts`, {}, this.apiKey, this.apiSecret, this.passphrase, requestOptions);
    }

    async getActiveOrders(instrumentId, limit, from, to, requestOptions) {
        return get(`${URL}/spot/v3/orders_pending`, {
            instrument_id: instrumentId,
            limit,
            from,
            to
        }, this.apiKey, this.apiSecret, this.passphrase, requestOptions);
    }

    async getOrder(symbol, orderId, requestOptions) {
        return get(`${URL}/spot/v3/orders/${orderId}`, {
            instrument_id: symbol
        }, this.apiKey, this.apiSecret, this.passphrase, requestOptions);
    }
};