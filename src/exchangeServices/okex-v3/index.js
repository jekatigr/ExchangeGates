const request = require('request-promise-native');
const CryptoJS = require('crypto-js');

const get = (url, params, apiKey, apiSecret, passphrase) => {
    let paramKeys = Object.keys(params);
    for (let index in paramKeys) {
        if (index === 0) {
            url += `?${paramKeys[index]}=${params[index]}`;
        }
        else {
            url += `&${paramKeys[index]}=${params[index]}`;
        }
    }
    const timestamp = new Date().toISOString();
    const dirUrl = url.replace(/.*\/\/[^\/]*/, '');
    let sign = CryptoJS.enc.Base64.stringify(CryptoJS.HmacSHA256(timestamp + 'GET' + dirUrl, apiSecret));
    let options = {
        method: 'get',
        headers: {
            'OK-ACCESS-KEY': apiKey,
            'OK-ACCESS-SIGN': sign,
            'OK-ACCESS-TIMESTAMP': timestamp,
            'OK-ACCESS-PASSPHRASE': passphrase,
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        },
        json: true
    };

    return request(url, options)
};

const URL = 'https://www.okex.com/api';

module.exports = class OkexApi {
    constructor(apiKey, apiSecret, passphrase) {
        this.apiKey = apiKey;
        this.apiSecret = apiSecret;
        this.passphrase = passphrase;
    }

    async getBalances() {
        return await get(`${URL}/spot/v3/accounts`, {}, this.apiKey, this.apiSecret, this.passphrase);
    }
};