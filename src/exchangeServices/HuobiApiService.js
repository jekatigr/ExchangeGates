const https = require ('https');
const ccxt = require('ccxt');
const request = require('request-promise-native');

const ExchangeServiceAbstract = require('./ExchangeServiceAbstract');
const fillBalancesWithMainAmount = require('../utils/BalancesUtil');
const { getPrices } = require('../utils/PriceUtil');
const AdjacencyMatrixUtil = require('../utils/AdjacencyMatrixUtil');
const { getConfig } = require('../ConfigLoader');

const HUOBI_TICKERS_API_URL = 'https://api.huobi.pro/market/tickers';

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

    async getPrices(currencies = []) {
        try {
            const { mainCurrency } = getConfig();
            const tickersRaw = JSON.parse(await request({url: HUOBI_TICKERS_API_URL, localAddress: this.getNextIp()}));
            const markets = await this.api.loadMarkets();
            const tickers = await this.api.marketGetTickers();

            return getPrices(tickers, currencies, mainCurrency);
        } catch (ex) {
            console.log(`Exception while fetching prices, ex: ${ex}, stacktrace: ${ex.stack}`);
            throw new Error(`Exception while fetching prices, ex: ${ex}`);
        }
    }
};