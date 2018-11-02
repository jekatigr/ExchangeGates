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

        this.api1 = new ccxt.bitfinex(
            {
                apiKey,
                secret: apiSecret,
                enableRateLimit: false,
                timeout: 10000
            }
        );

        this.api2 = new ccxt.bitfinex2(
            {
                apiKey,
                secret: apiSecret,
                enableRateLimit: false,
                timeout: 10000
            }
        );

        this.orderBooksCache = undefined;
    }

    rotateAgent1() {
        this.api1.agent = https.Agent({
            localAddress: this.getNextIp()
        });
    }

    rotateAgent2() {
        this.api2.agent = https.Agent({
            localAddress: this.getNextIp()
        });
    }

    async getMarkets() {
        try {
            this.rotateAgent2();
            const markets = await this.api2.loadMarkets();

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
            this.rotateAgent2();
            const res = await this.api2.fetchTickers();

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
            this.rotateAgent2();
            const res = await this.api2.fetchBalance();

            const { free, total, used } = res;

            const balances = [];
            for (const key of Object.keys(total)) {
                balances.push({
                    currency: key,
                    total: total[key],
                    used: used[key],
                    free: free[key]
                });
            }

            const balancesFiltered = (currencies.length > 0)
                ? balances.filter(b => currencies.includes(b.currency))
                : balances;

            const prices = await this.getPrices(balances.map(b => b.currency));

            for (const balance of balancesFiltered) {
                const price = prices.find(p => p.base === balance.currency);
                if (price) {
                    balance.mainAmount = +Big(balance.total).times(price.bid);
                }
            }

            return balancesFiltered;
        } catch (ex) {
            console.log(`Exception while fetching balances, ex: ${ex}, stacktrace: ${ex.stack}`);
            throw new Error(`Exception while fetching balances, ex: ${ex}`);
        }
    }

    async createOrder({ symbol, operation, price, amount, cancelAfter } = {}) {
        if (!symbol || !operation || !price || !amount) {
            throw new Error('Exception while creating order, params missing');
        }

        try {
            this.rotateAgent1();
            const res = await this.api1.createOrder(
                symbol,
                'limit',
                operation,
                amount,
                price
            );

            const [ base, quote ] = res.symbol.split('/');
            const order = {
                id: res.id,
                base,
                quote,
                operation: res.side,
                amount: res.amount,
                remain: (res.remaining === undefined) ? res.amount : res.remaining,
                price: res.price,
                created: res.timestamp,
                status: 'active',
                average: res.average
            };

            if (cancelAfter && cancelAfter > 0 && order.status !== 'closed') {
                setTimeout(async () => {
                    try {
                        await this.api.cancelOrder(order.id);
                        console.log(`Order (id: ${order.id}) cancelled.`);
                    } catch (ex) {
                        console.log(`Exception while canceling order with id: ${order.id}, ex: ${ex}, stacktrace: ${ex.stack}`);
                    }
                }, cancelAfter);
            }

            return order;
        } catch (ex) {
            console.log(`Exception while creating order, ex: ${ex}, stacktrace: ${ex.stack}`);
            throw new Error(`Exception while creating order, ex: ${ex.stack}`);
        }
    }

    async cancelOrders(ids = []) {
        if (ids.length === 0) {
            console.log('Exception while canceling orders, params missing');
            throw new Error('Exception while canceling orders, params missing');
        }
        const result = [];
        /* eslint-disable no-await-in-loop */
        for (const orderId of ids) {
            try {
                this.rotateAgent1();
                await this.api1.cancelOrder(orderId, { localAddress: super.getNextIp() });
                result.push({ id: orderId, success: true });
            } catch (ex) {
                console.log(`Exception while canceling order, ex: ${ex}, stacktrace: ${ex.stack}`);
                result.push({ id: orderId, success: false, error: ex.message });
            }
        }
        /* eslint-enable no-await-in-loop */
        return result;
    }

    async getActiveOrders(symbol) {
        try {
            this.rotateAgent1();
            const openOrders = await this.api1.fetchOpenOrders(symbol) || [];
            return openOrders.map(o => ({
                id: o.id,
                base: o.symbol.split('/')[0],
                quote: o.symbol.split('/')[1],
                operation: o.side,
                amount: o.amount,
                remain: (o.remaining === undefined) ? o.amount : o.remaining,
                price: o.price,
                average: o.average,
                created: o.timestamp,
                status: 'active'
            }));
        } catch (ex) {
            console.log(`Exception while fetching active orders, ex: ${ex}, stacktrace: ${ex.stack}`);
            throw new Error(`Exception while fetching active orders, ex: ${ex}`);
        }
    }

    async getOrders(ids = []) {
        if (ids.length === 0) {
            console.log('Exception while getting orders, params missing');
            throw new Error('Exception while getting orders, params missing');
        }

        const result = [];
        /* eslint-disable no-await-in-loop */
        for (const orderId of ids) {
            try {
                this.rotateAgent1();
                const o = await this.api1.fetchOrder(orderId);
                result.push({
                    success: true,
                    id: o.id,
                    base: o.symbol.split('/')[0],
                    quote: o.symbol.split('/')[1],
                    operation: o.side,
                    amount: o.amount,
                    remain: (o.remaining === undefined) ? o.amount : o.remaining,
                    price: o.price,
                    average: o.average,
                    created: o.timestamp,
                    status: (o.status === 'open') ? 'active' : o.status
                });
            } catch (ex) {
                console.log(`Exception while getting order, ex: ${ex}, stacktrace: ${ex.stack}`);
                result.push({ id: orderId, success: false, error: ex.message });
            }
        }
        /* eslint-enable no-await-in-loop */
        return result;
    }
};