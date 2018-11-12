const https = require('https');
const ccxt = require('ccxt');
const WebSocket = require('ws');
const pako = require('pako');
const Big = require('big.js');

const ExchangeServiceAbstract = require('./ExchangeServiceAbstract');
const { getPrices } = require('../utils/PriceUtil');
const { getConfig } = require('../ConfigLoader');

const WS_URL = 'wss://api.huobi.pro/ws';

/**
 * Конвертер ордербуков из формата массивов в формат объектов
 * @param rawOrderBook
 */
const convertToOrderbook = (rawOrderBook) => {
    const { asks, bids } = rawOrderBook;
    const res = {
        asks: [],
        bids: []
    };

    for (const ask of asks) {
        const [ price, amount ] = ask;
        res.asks.push({
            price,
            amount
        });
    }

    for (const bid of bids) {
        const [ price, amount ] = bid;
        res.bids.push({
            price,
            amount
        });
    }

    return res;
};

/**
 * Конвертер ордербуков в тикеры
 * @param orderBooks
 */
const convertOrderBooksToTickers = orderBooks => (
    orderBooks.map((o) => {
        const { base, quote, asks, bids } = o;
        const [{ price: ask }] = asks;
        const [{ price: bid }] = bids;
        return {
            base,
            quote,
            ask,
            bid
        };
    })
);

module.exports = class HuobiApiService extends ExchangeServiceAbstract {
    constructor() {
        const config = getConfig();
        const { exchange, apiKey, apiSecret, ipArray } = config;

        super(exchange, ipArray);

        this.api = new ccxt.huobipro({
            apiKey,
            secret: apiSecret,
            enableRateLimit: false,
            timeout: 10000
        });

        this.orderBooks = [];
        this.orderBooksCache = undefined; // кэш ордербуков для клиента
        this.notifierParams = undefined;
        this.notifireIntervalId = undefined;
        this.storeOrderBooks = [];

        this.initWS();
    }

    rotateAgent() {
        this.api.agent = https.Agent({
            localAddress: this.getNextIp()
        });
    }

    async initWS() {
        function subscribe(ws, symbols) {
            for (const symbol of symbols) {
                ws.send(JSON.stringify({
                    sub: `market.${symbol.symbol}.depth.step0`,
                    id: `${symbol.symbol}`
                }));
            }
        }

        function handle(data, callback) {
            const symbol = data.ch.split('.')[1];
            const channel = data.ch.split('.')[2];
            if (channel === 'depth') {
                callback(symbol, data.tick);
            }
        }

        function init(symbols, callback) {
            const ws = new WebSocket(WS_URL);

            ws.on('open', () => {
                console.log('open huobi ws');
                subscribe(ws, symbols);
            });

            ws.on('message', (data) => {
                const text = pako.inflate(data, { to: 'string' });
                const msg = JSON.parse(text);
                if (msg.ping) {
                    ws.send(JSON.stringify({ pong: msg.ping }));
                } else if (msg.tick) {
                    handle(msg, callback);
                }
            });

            ws.on('close', () => {
                console.log('close huobi ws');
                init(symbols, callback);
            });

            ws.on('error', (err) => {
                console.log('error on huobi ws:', err);
                init(symbols, callback);
            });
        }

        const markets = await this.getMarkets();
        const symbols = markets.map(m => ({
            symbol: `${m.base.toLowerCase()}${m.quote.toLowerCase()}`,
            base: m.base,
            quote: m.quote
        }));

        const saveLocalDepth = (symbol, orderbook) => {
            const symbolObj = symbols.find(s => s.symbol === symbol);
            const { base, quote } = symbolObj;
            const orderbookIndex = this.orderBooks.findIndex(e => e.base === base && e.quote === quote);
            const { asks, bids } = convertToOrderbook(orderbook);
            if (orderbookIndex !== -1) {
                this.orderBooks[orderbookIndex] = {
                    ...this.orderBooks[orderbookIndex],
                    bids,
                    asks
                };
            } else {
                this.orderBooks.push({
                    base,
                    quote,
                    bids,
                    asks
                });
            }
            this.storeUpdatedOrderBooksIfNeeded(base, quote);
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
            // отправляем все ордербуки после начала нотификации
            const orderBooks = this.getOrderBooks({ symbols, limit });
            callback(undefined, {
                timestampStart: +new Date(),
                timestampEnd: +new Date(),
                data: orderBooks
            });

            this.notifierRunning = true;
            this.notifierParams = {
                symbols,
                limit
            };

            this.notifireIntervalId = setInterval(() => {
                if (this.storeOrderBooks.length > 0) {
                    const timestampEnd = +new Date();
                    callback(undefined, {
                        timestampStart: this.notifierParams.timestampStart,
                        timestampEnd,
                        data: this.storeOrderBooks
                    });
                    this.storeOrderBooks = [];
                    this.notifierParams.timestampStart = undefined;
                }
            }, 0);
        }
    }

    storeUpdatedOrderBooksIfNeeded(base, quote) {
        if (this.notifierRunning && this.notifierParams) {
            if (!this.notifierParams.symbols
                || this.notifierParams.symbols.length === 0
                || this.notifierParams.symbols.includes(`${base}/${quote}`)
            ) {
                const [ updatedOrderBook ] = this.getUpdatedOrderBooks(false, {
                    symbols: [`${base}/${quote}`],
                    limit: this.notifierParams.limit
                }) || [];

                if (this.notifierRunning && updatedOrderBook) {
                    const existingIndex = this.storeOrderBooks
                        .findIndex(e => e.base === updatedOrderBook.base && e.quote === updatedOrderBook.quote);
                    if (existingIndex !== -1) {
                        this.storeOrderBooks.splice(existingIndex, 1);
                    }
                    this.storeOrderBooks.push(updatedOrderBook);
                    if (this.storeOrderBooks.length === 1) {
                        this.notifierParams.timestampStart = +new Date();
                    }
                }
            }
        }
    }

    stopOrderBookNotifier() {
        this.notifierRunning = false;
        this.notifierParams = undefined;
        this.orderBooksCache = undefined;
        clearInterval(this.notifireIntervalId);
        this.storeOrderBooks = [];
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

    getPrices(currencies = []) {
        try {
            const { mainCurrency } = getConfig();
            const orderBooks = this.getOrderBooks({ limit: 1 });
            const tickers = convertOrderBooksToTickers(orderBooks);

            return getPrices(tickers, currencies, mainCurrency);
        } catch (ex) {
            console.log(`Exception while fetching prices, ex: ${ex}, stacktrace: ${ex.stack}`);
            throw new Error(`Exception while fetching prices, ex: ${ex}`);
        }
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

            const balancesFiltered = (currencies.length > 0)
                ? balances.filter(b => currencies.includes(b.currency))
                : balances;
            const prices = this.getPrices(balancesFiltered.map(b => b.currency)) || [];

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
                average: orderRaw.average,
                created: orderRaw.timestamp,
                status: 'active'
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
                this.rotateAgent();
                await this.api.cancelOrder(orderId);
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

    async getOrders(ids = []) {
        if (ids.length === 0) {
            console.log('Exception while getting orders, params missing');
            throw new Error('Exception while getting orders, params missing');
        }

        const result = [];
        /* eslint-disable no-await-in-loop */
        for (const orderId of ids) {
            try {
                this.rotateAgent();
                const o = await this.api.fetchOrder(orderId);
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