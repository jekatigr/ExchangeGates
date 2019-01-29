const TidexApi = require('node-tidex-api');
const Big = require('big.js');
const ExchangeServiceAbstract = require('./ExchangeServiceAbstract');
const { getPrices } = require('../utils/PriceUtil');
const { timeout } = require('../utils/utils');

module.exports = class TidexApiService extends ExchangeServiceAbstract {
    constructor({ exchange, apiKey, apiSecret, ipArray, mainCurrency, currencies }, orderbooksUpdatedCallback) {
        super({ exchange, ipArray, mainCurrency, currencies }, orderbooksUpdatedCallback);

        this.api = new TidexApi({
            apiKey,
            apiSecret
        });

        this.orderBooksCache = undefined;
    }

    async getMarkets() {
        try {
            const markets = await this.api.getMarkets({ localAddress: super.getNextIp() });

            return markets.map(m => ({
                base: m.base,
                quote: m.quote,
                precision: {
                    price: m.precision,
                    amount: m.precision
                },
                taker: m.fee,
                maker: m.fee,
                limits: {
                    amount: {
                        min: m.minAmount,
                        max: m.maxAmount
                    },
                    price: {
                        min: m.minPrice,
                        max: m.maxPrice
                    },
                    cost: {
                        min: +Big(m.minAmount).times(m.minPrice)
                    }
                }
            }));
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
            const orderbooks = this.api.getOrderBooks({ limit, symbols: symbolsArr }, { localAddress: super.getNextIp() });

            if (orderbooks && orderbooks.length > 0) {
                if (this.orderbooksUpdatedCallback) {
                    for(const updatedOrderbook of orderbooks) {
                        this.orderbooksUpdatedCallback(updatedOrderbook);
                    }
                }
            }

            return orderbooks;
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
            const markets = await this.api.getMarkets({ localAddress: super.getNextIp() });

            return ExchangeServiceAbstract.calculateTriangles(this.currencies, markets);
        } catch (ex) {
            console.log(`Exception while fetching triangles, ex: ${ex}, stacktrace: ${ex.stack}`);
            throw new Error(`Exception while fetching triangles, ex: ${ex}`);
        }
    }

    async getPrices(currencies = []) {
        try {
            const tickers = await this.api.getTickers(undefined, { localAddress: super.getNextIp() }) || [];

            return getPrices(tickers, currencies, this.mainCurrency);
        } catch (ex) {
            console.log(`Exception while fetching prices, ex: ${ex}, stacktrace: ${ex.stack}`);
            throw new Error(`Exception while fetching prices, ex: ${ex}`);
        }
    }

    async getBalances(currencies = []) {
        try {
            const { balances } = await this.api.getAccountInfoExtended({ localAddress: super.getNextIp() });
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
                console.log(`Exception while canceling order, ex: ${ex}, stacktrace: ${ex.stack}`);
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