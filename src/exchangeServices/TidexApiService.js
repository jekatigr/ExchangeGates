const TidexApi = require('node-tidex-api');
const Big = require('big.js');
const ExchangeServiceAbstract = require('./ExchangeServiceAbstract');
const { getFormattedDate } = require('../utils/utils');

module.exports = class TidexApiService extends ExchangeServiceAbstract {
    constructor({ exchange, apiKey, apiSecret, ipArray }, orderbooksUpdatedCallback) {
        super({ exchange, ipArray }, orderbooksUpdatedCallback);

        this.api = new TidexApi({
            apiKey,
            apiSecret
        });

        this.orderBooks = [];
        this.orderBooksCache = undefined; // client's orderbooks cache
        this.notifireIntervalId = undefined;
    }

    async getMarkets() {
        try {
            const markets = await this.api.getMarkets(true, { localAddress: super.getNextIp() });

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
                        min: (m.minTotal) ? m.minTotal : +Big(m.minAmount).times(m.minPrice)
                    }
                }
            }));
        } catch (ex) {
            console.log(`${getFormattedDate()} | Exception while fetching markets, ex: ${ex}, stacktrace: ${ex.stack}`);
            throw new Error(`${getFormattedDate()} | Exception while fetching markets, ex: ${ex}`);
        }
    }

    async connectToExchange(symbols = []) {
        if (!this.wsInitialized) {
            try {
                this.wsInitialized = true;

                let symbolsArr = symbols;
                if (symbolsArr.length === 0) {
                    const markets = await this.api.getMarkets(true, { localAddress: super.getNextIp() });
                    symbolsArr = markets.map(m => `${m.base}/${m.quote}`);
                }

                /* eslint-disable no-await-in-loop */
                setInterval(async () => {
                    try {
                        const orderbooks = await this.api.getOrderBooks(
                            { limit: 100, symbols: symbolsArr },
                            { localAddress: super.getNextIp() }
                        );

                        this.orderBooks = orderbooks;

                        if (orderbooks && orderbooks.length > 0) {
                            if (this.orderbooksUpdatedCallback) {
                                for (const updatedOrderbook of orderbooks) {
                                    this.orderbooksUpdatedCallback(updatedOrderbook);
                                }
                            }
                        }
                    } catch (ex) {
                        console.log(`${getFormattedDate()} | Exception while fetching orderbooks, ex: ${ex}, stacktrace: ${ex.stack}`);
                    }
                }, 200);
                /* eslint-enable no-await-in-loop */
            } catch (ex) {
                console.log(`${getFormattedDate()} | Exception while connecting to orderbooks, ex: ${ex}, stacktrace: ${ex.stack}`);
                throw new Error(`${getFormattedDate()} | Exception while connecting to orderbooks, ex: ${ex}`);
            }
        }
    }

    getOrderbooks({ symbols = [], limit = 1 } = {}) {
        try {
            let orderbooks = this.orderBooks; // should be filled from connectToExchange method
            if (symbols && symbols.length > 0) {
                orderbooks = orderbooks.filter(o => symbols.includes(`${o.base}/${o.quote}`));
            }

            orderbooks = orderbooks.map(o => ({
                ...o,
                bids: o.bids.slice(0, limit),
                asks: o.asks.slice(0, limit),
            }));

            return orderbooks;
        } catch (ex) {
            console.log(`${getFormattedDate()} | Exception while fetching orderbooks, ex: ${ex}, stacktrace: ${ex.stack}`);
            throw new Error(`${getFormattedDate()} | Exception while fetching orderbooks, ex: ${ex}`);
        }
    }

    async getUpdatedOrderbooks(all = false, { symbols = [], limit = 1 }) {
        try {
            let result = [];
            const allOrderBooks = await this.getOrderbooks({ symbols, limit });
            if (!all && this.orderBooksCache) {
                result = ExchangeServiceAbstract.filterChangedOrderbooks(allOrderBooks, this.orderBooksCache);
            } else {
                result = allOrderBooks;
            }
            this.orderBooksCache = allOrderBooks;
            return result;
        } catch (ex) {
            console.log(`${getFormattedDate()} | Exception while fetching updated orderbooks, ex: ${ex}, stacktrace: ${ex.stack}`);
            throw new Error(`${getFormattedDate()} | Exception while fetching updated orderbooks, ex: ${ex}`);
        }
    }

    async runOrderBookNotifier({ symbols = [], limit = 1 } = {}, callback) {
        if (!this.notifierRunning) {
            this.notifierRunning = true;

            this.notifireIntervalId = setInterval(async () => {
                const start = +new Date();
                const updatedOrderBooks = await this.getUpdatedOrderbooks(false, {
                    symbols,
                    limit
                }) || [];

                if (this.notifierRunning && updatedOrderBooks.length > 0) {
                    callback(undefined, {
                        timestampStart: start,
                        timestampEnd: +new Date(),
                        data: updatedOrderBooks
                    });
                }
            }, 10);
        }
    }

    stopOrderBookNotifier() {
        this.notifierRunning = false;
        this.orderBooksCache = undefined;
        clearInterval(this.notifireIntervalId);
    }

    async getBalances(currencies = []) {
        try {
            const { balances } = await this.api.getAccountInfoExtended({ localAddress: super.getNextIp() });
            return ((currencies.length > 0)
                ? balances.filter(b => currencies.includes(b.currency))
                : balances);
        } catch (ex) {
            console.log(`${getFormattedDate()} | Exception while fetching balances, ex: ${ex}, stacktrace: ${ex.stack}`);
            throw new Error(`${getFormattedDate()} | Exception while fetching balances, ex: ${ex}`);
        }
    }

    async createOrder({ symbol, operation, price, amount, cancelAfter } = {}) {
        if (!symbol || !operation || !price || !amount) {
            console.log(`${getFormattedDate()} | Exception while creating order, params missing`);
            throw new Error(`${getFormattedDate()} | Exception while creating order, params missing`);
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
                        console.log(`${getFormattedDate()} | Order (id: ${order.id}) cancelled.`);
                    } catch (ex) {
                        console.log(`${getFormattedDate()} | Exception while canceling order with id: ${order.id}, ex: ${ex}, stacktrace: ${ex.stack}`);
                    }
                }, cancelAfter);
            }

            if (order.status === 'cancelled' || order.status === 'cancelled_partially') {
                order.status = 'canceled';
            }

            return order;
        } catch (ex) {
            console.log(`${getFormattedDate()} | Exception while creating order, ex: ${ex}, stacktrace: ${ex.stack}`);
            throw new Error(`${getFormattedDate()} | Exception while creating order, ex: ${ex}`);
        }
    }

    async cancelOrder({ id }) {
        if (!id) {
            console.log(`${getFormattedDate()} | Exception while canceling order, id missing`);
            throw new Error(`${getFormattedDate()} | Exception while canceling order, id missing`);
        }

        try {
            await this.api.cancelOrder(id, { localAddress: super.getNextIp() });
        } catch (ex) {
            console.log(`${getFormattedDate()} | Exception while canceling order, ex: ${ex}, stacktrace: ${ex.stack}`);
            throw new Error(`${getFormattedDate()} | Exception while canceling order, orderId: '${id}', ex: ${ex}`);
        }
    }

    async getActiveOrders(symbol) {
        try {
            const orders = await this.api.getActiveOrders(symbol, { localAddress: super.getNextIp() });
            return orders.map(o => ({
                ...o,
                status: (o.status === 'cancelled' || o.status === 'cancelled_partially') ? 'canceled' : o.status
            }));
        } catch (ex) {
            console.log(`${getFormattedDate()} | Exception while fetching active orders, ex: ${ex}, stacktrace: ${ex.stack}`);
            throw new Error(`${getFormattedDate()} | Exception while fetching active orders, ex: ${ex}`);
        }
    }

    async getOrder({ id }) {
        if (!id) {
            console.log(`${getFormattedDate()} | Exception while getting order, id missing`);
            throw new Error(`${getFormattedDate()} | Exception while getting order, id missing`);
        }

        try {
            const order = await this.api.getOrder(id, { localAddress: super.getNextIp() });
            return {
                ...order,
                status: (order.status === 'cancelled' || order.status === 'cancelled_partially') ? 'canceled' : order.status
            };
        } catch (ex) {
            console.log(`${getFormattedDate()} | Exception while getting order, orderId: '${id}', ex: ${ex}, stacktrace: ${ex.stack}`);
            throw new Error(`${getFormattedDate()} | Exception while getting order, orderId: '${id}', ex: ${ex}`);
        }
    }
};