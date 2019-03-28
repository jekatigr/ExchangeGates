const https = require('https');
const ccxt = require('ccxt');
const WebSocket = require('ws');
const pako = require('pako');
const Big = require('big.js');
const binance = require('node-binance-api')();
const { timeout } = require('../utils/utils');

const ExchangeServiceAbstract = require('./ExchangeServiceAbstract');

const WS_URL = 'wss://api.huobi.pro/ws';

/**
 * Конвертер ордербуков из формата массивов в формат объектов
 * @param rawOrderBook
 */
const convertToOrderbook = (rawOrderBook) => {
    const { asks, bids } = rawOrderBook;

    const asksArr = [];
    for (let key of Object.keys(asks)) {
        asksArr.push([ +key, asks[key] ]);
    }
    const bidsArr = [];
    for (let key of Object.keys(bids)) {
        bidsArr.push([ +key, bids[key] ]);
    }
    asksArr.sort((a1, a2) => {
        if (a1[0] < a2[0]) return -1;
        if (a1[0] > a2[0]) return 1;
        return 0;
    });
    bidsArr.sort((a1, a2) => {
        if (a1[0] > a2[0]) return -1;
        if (a1[0] < a2[0]) return 1;
        return 0;
    });

    const res = {
        asks: [],
        bids: []
    };

    for (const ask of asksArr) {
        const [ price, amount ] = ask;
        res.asks.push({
            price,
            amount
        });
    }

    for (const bid of bidsArr) {
        const [ price, amount ] = bid;
        res.bids.push({
            price,
            amount
        });
    }

    return res;
};

module.exports = class BinanceApiService extends ExchangeServiceAbstract {
    constructor({ exchange, apiKey, apiSecret, ipArray }, orderbooksUpdatedCallback) {
        super({ exchange, ipArray }, orderbooksUpdatedCallback);

        this.api = new ccxt.binance({
            apiKey,
            secret: apiSecret,
            enableRateLimit: false,
            timeout: 10000
        });

        this.orderBooks = [];
        this.orderBooksCache = undefined; // кэш ордербуков для клиента
        this.notifireIntervalId = undefined;

        this.initWS();
    }

    rotateAgent() {
        this.api.agent = https.Agent({
            localAddress: this.getNextIp()
        });
    }

    async initWS() {
        async function init(symbols, callback) {
            const symbolsArr = symbols.map(s => s.symbol);
            let i = 0;
            for (const m of symbolsArr) {
                i += 1;

                try {
                    binance.websockets.depthCache([m], callback);
                    await timeout(300)
                } catch (ex) {
                    console.log(`Exception while subscribe to ws ${m}, ex: ${ex}, stacktrace: ${ex.stack}`);
                    throw new Error(`Exception while subscribe to ws, ex: ${ex}`);
                }

                console.log(`(${i}/${symbolsArr.length}) Subscribed to ${m} orderbook ws (${new Date()})`);
            }
        }

        const markets = await this.getMarkets();
        const symbols = markets.map(m => ({
            symbol: `${m.base
                .replace('YOYOW', 'YOYO')
                .replace('XRB', 'NANO')}${m.quote}`,
            base: m.base,
            quote: m.quote
        })).filter(s => s.base !== 'BCH');

        const saveLocalDepth = (symbol, orderbook) => {
            const symbolObj = symbols.find(s => s.symbol === symbol);
            const { base, quote } = symbolObj;
            const orderbookIndex = this.orderBooks.findIndex(e => e.base === base && e.quote === quote);
            const { asks, bids } = convertToOrderbook(orderbook);
            let updatedOrderbook;
            if (orderbookIndex !== -1) {
                updatedOrderbook = {
                    ...this.orderBooks[orderbookIndex],
                    bids,
                    asks
                };
                this.orderBooks[orderbookIndex] = updatedOrderbook;
            } else {
                updatedOrderbook = {
                    base,
                    quote,
                    bids,
                    asks
                };
                this.orderBooks.push(updatedOrderbook);
            }

            if (this.orderbooksUpdatedCallback) {
                this.orderbooksUpdatedCallback(updatedOrderbook);
            }
        };

        init(symbols, saveLocalDepth.bind(this));
    }


    async getMarkets() {
        try {
            this.rotateAgent();
            const markets = await this.api.loadMarkets();

            const res = [];
            const marketIds = Object.keys(markets);
            for (const marketId of marketIds) {
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

    getOrderBooks({ symbols = [], limit = 1 } = {}) {
        try {
            let orderbooks = this.orderBooks; // должен быть заполнен из вебсокета
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
            console.log(`Exception while fetching orderbooks, ex: ${ex}, stacktrace: ${ex.stack}`);
            throw new Error(`Exception while fetching orderbooks, ex: ${ex}`);
        }
    }

    /**
     * Возвращает обновленные ордербуки для клиента. Сохраняет кэш ордербуков, которые уже были отправлены клиенту.
     * @param all
     * @param symbols
     * @param limit
     * @returns {Array}
     */
    getUpdatedOrderBooks(all = false, { symbols = [], limit = 1 }) {
        try {
            let result = [];
            const allOrderBooks = this.getOrderBooks({ symbols, limit });
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

    runOrderBookNotifier({ symbols = [], limit = 1 } = {}, callback) {
        if (!this.notifierRunning) {
            this.notifierRunning = true;

            this.notifireIntervalId = setInterval(() => {
                const start = +new Date();
                const updatedOrderBooks = this.getUpdatedOrderBooks(false, {
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
            this.rotateAgent();
            let balances = await this.api.fetchBalance();
            delete balances.free;
            delete balances.used;
            delete balances.total;
            delete balances.info;
            balances = Object.entries(balances).filter(e => e[1].total > 0).map(e => ({
                currency: e[0],
                free: e[1].free,
                used: e[1].used,
                total: e[1].total,
            }));

            return ((currencies.length > 0)
                ? balances.filter(b => currencies.includes(b.currency))
                : balances);
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
            this.rotateAgent();
            const orderRaw = await this.api.createOrder(
                symbol,
                'limit',
                operation,
                amount,
                price
            );

            const [ base, quote ] = orderRaw.symbol.split('/');

            const order = {
                id: orderRaw.id,
                base,
                quote,
                operation: orderRaw.side,
                amount: orderRaw.amount,
                remain: (orderRaw.remaining === undefined) ? orderRaw.amount : orderRaw.remaining,
                price: orderRaw.price,
                average: (orderRaw.average === undefined) ? 0 : orderRaw.average,
                created: orderRaw.timestamp,
                status: 'active'
            };

            if (cancelAfter && cancelAfter > 0 && order.status !== 'closed') {
                setTimeout(async () => {
                    try {
                        await this.api.cancelOrder(order.id, symbol);
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

    async cancelOrder({ symbol, id }) {
        if (!id || !symbol) {
            console.log('Exception while canceling order, params missing');
            throw new Error('Exception while canceling order, params missing');
        }

        try {
            this.rotateAgent();
            await this.api.cancelOrder(id, symbol);
        } catch (ex) {
            console.log(`Exception while canceling order, ex: ${ex}, stacktrace: ${ex.stack}`);
            throw new Error(`Exception while canceling order, orderId: '${id}', ex: ${ex}`);
        }
    }

    async getActiveOrders(params) {
        if (!params || params.length === 0) {
            console.log('Exception while getting active orders, symbol missing');
            throw new Error('Exception while getting active orders, symbol missing');
        }

        const [ symbol ] = params;

        try {
            this.rotateAgent();
            const openOrders = await this.api.fetchOpenOrders(symbol) || [];
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

    async getOrder({ symbol, id }) {
        if (!id || !symbol) {
            console.log('Exception while getting order, params missing');
            throw new Error('Exception while getting order, params missing');
        }

        try {
            this.rotateAgent();
            const o = await this.api.fetchOrder(id, symbol);
            return {
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
            };
        } catch (ex) {
            console.log(`Exception while getting order, orderId: '${id}', ex: ${ex}, stacktrace: ${ex.stack}`);
            throw new Error(`Exception while getting order, orderId: '${id}', ex: ${ex}`);
        }
    }
};