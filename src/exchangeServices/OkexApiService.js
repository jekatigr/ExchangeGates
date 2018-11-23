const request = require('request-promise-native');
const WebSocket = require('ws');
const pako = require('pako');
const Big = require('big.js');

const ExchangeServiceAbstract = require('./ExchangeServiceAbstract');
const { getPrices } = require('../utils/PriceUtil');
const { getConfig } = require('../ConfigLoader');

module.exports = class OkexApiService extends ExchangeServiceAbstract {
    constructor() {
        const config = getConfig();
        const { exchange, apiKey, apiSecret, ipArray } = config;

        super(exchange, ipArray);

        this.orderBooks = [];
        this.orderBooksCache = undefined; // кэш ордербуков для клиента
        this.notifireIntervalId = undefined;
    }

    async getMarkets() {
        try {
            const raw = await request({
                url: 'https://www.okex.com/v2/spot/markets/products',
                json: true,
                localAddress: this.getNextIp(),
                timeout: 10000
            });

            if (raw && raw.data && raw.data.length > 0) {
                return raw.data.map(m => {
                    const [ base, quote ] = m.symbol.split('_');

                    return {
                        base: base.toUpperCase(),
                        quote: quote.toUpperCase(),
                        precision: {
                            price: m.maxPriceDigit,
                            amount: m.maxSizeDigit
                        },
                        taker: 0.0020,
                        maker: 0.0015,
                        limits: {
                            amount: {
                                min: m.minTradeSize
                            },
                            price: {},
                            cost: {}
                        }
                    }
                });
            }

            console.log(`Exception while fetching markets, okex doesn't return data, response: ${raw}`);
            throw new Error(`Exception while fetching markets, okex doesn't return data, response: ${raw}`);
        } catch (ex) {
            console.log(`Exception while fetching markets, ex: ${ex}, stacktrace: ${ex.stack}`);
            throw new Error(`Exception while fetching markets, ex: ${ex}`);
        }
    }

    async getTriangles() {
        try {
            const config = getConfig();
            const { currencies } = config;

            const markets = await this.getMarkets();

            return ExchangeServiceAbstract.calculateTriangles(currencies, markets);
        } catch (ex) {
            console.log(`Exception while fetching triangles, ex: ${ex}, stacktrace: ${ex.stack}`);
            throw new Error(`Exception while fetching triangles, ex: ${ex}`);
        }
    }
};