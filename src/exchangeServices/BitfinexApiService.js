const https = require('https');
const ccxt = require('ccxt');
const ExchangeServiceAbstract = require('./ExchangeServiceAbstract');
const AdjacencyMatrixUtil = require('../utils/AdjacencyMatrixUtil');
const { getConfig } = require('../ConfigLoader');

module.exports = class BitfinexApiService extends ExchangeServiceAbstract {
    constructor() {
        const config = getConfig();
        const { exchange, apiKey, apiSecret, ipArray } = config;

        super(exchange, ipArray);

        this.api = new ccxt.bitfinex(
            {
                apiKey,
                secret: apiSecret,
                enableRateLimit: false,
                timeout: 10000
            }
        );
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
            for (const marketId of Object.keys(markets)) {
                const market = markets[marketId];
                const { base, quote, precision, taker, maker, limits } = market;
                res.push({
                    base,
                    quote,
                    precision,
                    taker,
                    maker,
                    limits
                });
            }
            return res;
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

            // создаем матрицу смежности
            const matrix = AdjacencyMatrixUtil.fillAdjacencyMatrixForCurrencies(markets, currencies);

            return ExchangeServiceAbstract.calculateTriangles(currencies, matrix);
        } catch (ex) {
            console.log(`Exception while fetching triangles, ex: ${ex}, stacktrace: ${ex.stack}`);
            throw new Error(`Exception while fetching triangles, ex: ${ex}`);
        }
    }
};