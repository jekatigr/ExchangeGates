const https = require('https');
const ccxt = require('ccxt');
const Big = require('big.js');
const { getPrices } = require('../utils/PriceUtil');
const ExchangeServiceAbstract = require('./ExchangeServiceAbstract');
const { getConfig } = require('../ConfigLoader');

module.exports = class BitfinexApiService extends ExchangeServiceAbstract {
    constructor() {
        const config = getConfig();
        const { exchange, apiKey, apiSecret, ipArray } = config;

        super(exchange, ipArray);

        this.api = new ccxt.bitfinex2(
            {
                apiKey,
                secret: apiSecret,
                enableRateLimit: false,
                timeout: 10000
            }
        );

        this.orderBooksCache = undefined;
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

            return ExchangeServiceAbstract.calculateTriangles(currencies, markets);
        } catch (ex) {
            console.log(`Exception while fetching triangles, ex: ${ex}, stacktrace: ${ex.stack}`);
            throw new Error(`Exception while fetching triangles, ex: ${ex}`);
        }
    }

    async getPrices(currencies = []) {
        try {
            const { mainCurrency } = getConfig();
            this.rotateAgent();
            const res = await this.api.fetchTickers();

            const tickers = [];
            for (const key of Object.keys(res)) {
                const ticker = res[key];
                const { ask, bid } = ticker;
                const symbol = key.split('/');
                tickers.push({
                    base: symbol[0].toUpperCase(),
                    quote: symbol[1].toUpperCase(),
                    ask,
                    bid
                });
            }
            return getPrices(tickers, currencies, mainCurrency);
        } catch (ex) {
            console.log(`Exception while fetching prices, ex: ${ex}, stacktrace: ${ex.stack}`);
            throw new Error(`Exception while fetching prices, ex: ${ex}`);
        }
    }

    async getBalances(currencies = []) {
        try {
            this.rotateAgent();
            const res = await this.api.fetchBalance();

            const { free, total, used } = res;

            const balances = [];
            for (const key of Object.keys(total)) {
                balances.push({
                    currency: key,
                    total: total[key],
                    used: used[key],
                    free: free[key]
                })
            }

            const balancesFiltered = (currencies.length > 0)
                ? balances.filter(b => currencies.includes(b.currency))
                : balances;

            const prices =  await this.getPrices(balances.map(b => b.currency));

            for (const balance of balancesFiltered) {
                const price = prices.find(p => p.base === balance.currency);
                if (price) {
                    balance.mainAmount = +Big(balance.total).times(price.bid);
                }
            }

            return balancesFiltered;
        } catch (ex) {
            console.log(`Exception while fetching prices, ex: ${ex}, stacktrace: ${ex.stack}`);
            throw new Error(`Exception while fetching prices, ex: ${ex}`);
        }
    }
};