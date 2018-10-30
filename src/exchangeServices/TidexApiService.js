const TidexApi = require('node-tidex-api');
const ExchangeServiceAbstract = require('./ExchangeServiceAbstract');
const fillBalancesWithMainAmount = require('../utils/BalancesUtil');
const { getPrices } = require('../utils/PriceUtil');
const AdjacencyMatrixUtil = require('../utils/AdjacencyMatrixUtil');
const { getConfig } = require('../ConfigLoader');
const { timeout } = require('../utils/utils');

module.exports = class TidexApiService extends ExchangeServiceAbstract {
    constructor() {
        const config = getConfig();
        const { exchange, apiKey, apiSecret, ipArray } = config;

        super(exchange, ipArray);

        this.api = new TidexApi({
            apiKey,
            apiSecret
        });

        this.orderBooksCache = undefined;
    }

    async getMarkets() { // TODO переформатировать результат в общий шаблон, как у ccxt
        try {
            return await this.api.getMarkets({ localAddress: super.getNextIp() });
        } catch (ex) {
            console.log(`Exception while fetching markets, ex: ${ex}, stacktrace: ${ex.stack}`);
            throw new Error(`Exception while fetching markets, ex: ${ex}`);
        }
    }

    async getOrderBooks({ symbols = [], limit = 1 } = {}) {
        try {
            let symbolsArr = symbols;
            if (symbolsArr.length === 0) {
                const markets = await this.api.getMarkets({ localAddress: super.getNextIp() });
                symbolsArr = markets.map(m => `${m.base}/${m.quote}`);
            }
            return this.api.getOrderBooks({ limit, symbols: symbolsArr }, { localAddress: super.getNextIp() });
        } catch (ex) {
            console.log(`Exception while fetching orderbooks, ex: ${ex}, stacktrace: ${ex.stack}`);
            throw new Error(`Exception while fetching orderbooks, ex: ${ex}`);
        }
    }

    async getUpdatedOrderBooks(all = false, { symbols = [], limit = 1 }) {
        try {
            let result = [];
            const allOrderBooks = await this.getOrderBooks({ symbols, limit });
            if (!all && this.orderBooksCache) {
                result = ExchangeServiceAbstract.filterChangedOrderBooks(allOrderBooks, this.orderBooksCache);
            } else {
                result = allOrderBooks;
            }
            this.orderBooksCache = allOrderBooks;
            return result;
        } catch (ex) {
            console.log(`Exception while fetching updated orderbooks, ex: ${ex}, stacktrace: ${ex.stack}`);
            throw new Error(`Exception while fetching updated orderbooks, ex: ${ex}`);
        }
    }

    async runOrderBookNotifier({ symbols = [], limit = 1 } = {}, callback) {
        this.notifierRunning = true;
        let firstFetch = true;
        /* eslint-disable no-await-in-loop */
        while (this.notifierRunning) {
            const start = +new Date();
            try {
                const updatedOrderBooks = await this.getUpdatedOrderBooks(firstFetch, { symbols, limit });
                firstFetch = false;
                if (this.notifierRunning && updatedOrderBooks && updatedOrderBooks.length > 0) {
                    callback(undefined, {
                        timestampStart: start,
                        timestampEnd: +new Date(),
                        data: updatedOrderBooks
                    });
                }
            } catch (ex) {
                callback({
                    timestampStart: start,
                    timestampEnd: +new Date(),
                    data: ex.message
                });
            }
            await timeout(100);
        }
        /* eslint-enable no-await-in-loop */
    }

    async getTriangles() {
        try {
            const config = getConfig();
            const { currencies } = config;

            const markets = await this.api.getMarkets({ localAddress: super.getNextIp() });

            return ExchangeServiceAbstract.calculateTriangles(currencies, markets);
        } catch (ex) {
            console.log(`Exception while fetching triangles, ex: ${ex}, stacktrace: ${ex.stack}`);
            throw new Error(`Exception while fetching triangles, ex: ${ex}`);
        }
    }

    async getPrices(currencies = []) {
        try {
            const { mainCurrency } = getConfig();
            const tickers = await this.api.getTickers(undefined, { localAddress: super.getNextIp() }) || [];

            return getPrices(tickers, currencies, mainCurrency);
        } catch (ex) {
            console.log(`Exception while fetching prices, ex: ${ex}, stacktrace: ${ex.stack}`);
            throw new Error(`Exception while fetching prices, ex: ${ex}`);
        }
    }

    async getBalances(currencies = []) {
        try {
            const { mainCurrency } = getConfig();
            const { balances } = await this.api.getAccountInfoExtended({ localAddress: super.getNextIp() });
            const tickers = await this.api.getTickers(undefined, { localAddress: super.getNextIp() }) || [];

            const balancesFiltered = (currencies.length > 0)
                ? balances.filter(b => currencies.includes(b.currency))
                : balances;

            return fillBalancesWithMainAmount(balancesFiltered, tickers, mainCurrency);
        } catch (ex) {
            console.log(`Exception while fetching balances, ex: ${ex}, stacktrace: ${ex.stack}`);
            throw new Error(`Exception while fetching balances, ex: ${ex}`);
        }
    }

    async createOrder({ symbol, operation, price, amount, cancelAfter } = {}) {
        if (!symbol || !operation || !price || !amount) {
            console.log('Exception while creating order, params missing');
            throw new Error('Exception while creating order, params missing');
        }

        try {
            const order = await this.api.limitOrder(
                symbol,
                price,
                amount,
                operation,
                { localAddress: super.getNextIp() }
            );

            if (cancelAfter && cancelAfter > 0 && order.status !== 'closed') {
                setTimeout(async () => {
                    try {
                        await this.api.cancelOrder(order.id, { localAddress: super.getNextIp() });
                        console.log(`Order (id: ${order.id}) cancelled.`);
                    } catch (ex) {
                        console.log(`Exception while canceling order with id: ${order.id}, ex: ${ex}, stacktrace: ${ex.stack}`);
                    }
                }, cancelAfter);
            }

            return order;
        } catch (ex) {
            console.log(`Exception while creating order, ex: ${ex}, stacktrace: ${ex.stack}`);
            throw new Error(`Exception while creating order, ex: ${ex}`);
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
                await this.api.cancelOrder(orderId, { localAddress: super.getNextIp() });
                result.push({ id: orderId, success: true });
            } catch (ex) {
                console.log(`Exception while creating order, ex: ${ex}, stacktrace: ${ex.stack}`);
                result.push({ id: orderId, success: false, error: ex.message });
            }
        }
        /* eslint-enable no-await-in-loop */
        return result;
    }

    async getActiveOrders(symbol) {
        try {
            return await this.api.getActiveOrders(symbol, { localAddress: super.getNextIp() });
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
                const order = await this.api.getOrder(orderId, { localAddress: super.getNextIp() });
                result.push({ ...order, success: true });
            } catch (ex) {
                console.log(`Exception while getting order, ex: ${ex}, stacktrace: ${ex.stack}`);
                result.push({ id: orderId, success: false, error: ex.message });
            }
        }
        /* eslint-enable no-await-in-loop */
        return result;
    }
};