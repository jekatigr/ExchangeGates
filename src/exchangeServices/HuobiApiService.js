const https = require ('https');
const ccxt = require('ccxt');
const ExchangeServiceAbstract = require('./ExchangeServiceAbstract');
const fillBalancesWithMainAmount = require('../utils/BalancesUtil');
const { getPrices } = require('../utils/PriceUtil');
const AdjacencyMatrixUtil = require('../utils/AdjacencyMatrixUtil');
const { getConfig } = require('../ConfigLoader');

module.exports = class HuobiApiService extends ExchangeServiceAbstract {
    constructor() {
        const config = getConfig();
        const { exchange, apiKey, apiSecret, ipArray } = config;

        super(exchange, ipArray);

        this.api = new ccxt.huobipro({
            apiKey: apiKey,
            secret: apiSecret,
            enableRateLimit: false,
            timeout: 10000
        });
    }

    rotateAgent() {
        this.api.agent = https.Agent({
            localAddress: this.getNextIp()
        });
    }

    async getMarkets() {
        try {
            this.rotateAgent();
            const markets = await this.api.loadMarkets();

            const res = [];
            for (let marketId in markets) {
                let market = markets[marketId];
                const { base, quote, precision, taker, maker, limits } = market;
                res.push({
                    base,
                    quote,
                    precision,
                    taker,
                    maker,
                    limits
                })
            }
            return res;
        } catch (ex) {
            console.log(`Exception while fetching markets, ex: ${ex}, stacktrace: ${ex.stack}`);
            throw new Error(`Exception while fetching markets, ex: ${ex}`);
        }
    }
};