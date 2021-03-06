const https = require('https');
const ccxt = require('ccxt');
const WebSocket = require('ws');
const pako = require('pako');
const Big = require('big.js');
const request = require('request-promise-native');

const ExchangeServiceAbstract = require('./ExchangeServiceAbstract');
const { makeChunks, getFormattedDate } = require('../utils/utils');

const WS_URL = 'wss://push.bibox.com/';

/**
 * Converts raw orderbooks from arrays to objects.
 * @param rawOrderBook
 */
const convertToOrderbook = (rawOrderBook) => {
    const { asks = [], bids = [] } = rawOrderBook;
    return {
        asks: asks.map(e => ({
            price: +e.price,
            amount: +e.volume
        })),
        bids: bids.map(e => ({
            price: +e.price,
            amount: +e.volume
        }))
    };
};

module.exports = class BiboxApiService extends ExchangeServiceAbstract {
    constructor({ exchange, apiKey, apiSecret, ipArray }, orderbooksUpdatedCallback) {
        super({ exchange, ipArray }, orderbooksUpdatedCallback);

        this.api = new ccxt.bibox({
            apiKey,
            secret: apiSecret,
            enableRateLimit: false,
            timeout: 10000
        });

        this.orderBooks = [];
        this.orderBooksCache = undefined; // client's orderbooks cache
        this.notifireIntervalId = undefined;
    }

    rotateAgent() {
        this.api.agent = https.Agent({
            localAddress: this.getNextIp()
        });
    }

    async initWS(symbolsObj) {
        function subscribe(ws, symbols) {
            for (const symbol of symbols) {
                ws.send(JSON.stringify({
                    event: 'addChannel',
                    channel: `bibox_sub_spot_${symbol.symbol}_depth`
                }));
            }
            console.log(`${getFormattedDate()} | Subscribed to Bibox ${symbols.length} orderbook channels.`);
        }

        function handle(msg, callback) {
            const { channel, data } = msg;
            const text = pako.inflate(Buffer.from(data, 'base64'), {
                to: 'string'
            });

            const recvMsg = JSON.parse(text);
            const channelArr = channel.split('_');
            const symbol = `${channelArr[3]}_${channelArr[4]}`;
            const channelType = channelArr[5];
            switch (channelType) {
                case 'depth':
                    callback(symbol, recvMsg);
                    break;
                default:
                    console.error(`${getFormattedDate()} | ws invalid channel, msg: ${msg}`);
            }
        }

        function init(symbols, callback) {
            const ws = new WebSocket(WS_URL);

            ws.on('open', () => {
                console.log(`${getFormattedDate()} | Opened bibox ws.`);
                subscribe(ws, symbols);
            });

            ws.on('message', (data) => {
                const msg = JSON.parse(data);
                if (msg[0]) {
                    handle(msg[0], callback);
                } else if (msg.ping) {
                    ws.send(JSON.stringify({
                        pong: msg.ping
                    }));
                } else {
                    console.error(`${getFormattedDate()} | Bibox ws error, msg: ${msg}`);
                }
            });

            ws.on('close', (msg) => {
                console.log(`${getFormattedDate()} | Closed bibox ws, msg: ${msg}`);
                init(symbols, callback);
            });

            ws.on('error', (err) => {
                console.log(`${getFormattedDate()} | Error on bibox ws: ${err}`);
                init(symbols, callback);
            });
        }

        const saveLocalDepth = (symbol, orderbook) => {
            const symbolObj = symbolsObj.find(s => s.symbol === symbol);
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

        const symbolsSplitted = makeChunks(symbolsObj, 20);
        for (const chunk of symbolsSplitted) {
            init(chunk, saveLocalDepth.bind(this));
        }
    }


    async getMarkets() {
        try {
            this.rotateAgent();
            const markets = await this.api.loadMarkets();

            const tradeLimits = await request({
                url: 'https://api.bibox.com/v1/orderpending?cmd=tradeLimit',
                localAddress: this.getNextIp(),
                json: true
            });

            const {
                min_trade_price: priceLimits,
                min_trade_amount: amountLimits,
                min_trade_money: costLimits
            } = tradeLimits.result;

            const res = [];
            const marketIds = Object.keys(markets);
            for (const marketId of marketIds) {
                const market = markets[marketId];
                const { base, quote, precision, taker, maker, active } = market;

                if (active) {
                    const priceLimit = (priceLimits[quote]) ? +priceLimits[quote] : +priceLimits.default;
                    const amountLimit = (amountLimits[base]) ? +amountLimits[base] : +amountLimits.default;
                    const costLimit = (costLimits[quote]) ? +costLimits[quote] : +Big(priceLimit).times(amountLimits);

                    const limits = {
                        price: {
                            min: priceLimit
                        },
                        amount: {
                            min: amountLimit
                        },
                        cost: {
                            min: costLimit
                        }
                    };

                    res.push({
                        base,
                        quote,
                        precision,
                        taker,
                        maker,
                        limits
                    });
                }
            }
            return res;
        } catch (ex) {
            console.log(`${getFormattedDate()} | Exception while fetching markets, ex: ${ex}, stacktrace: ${ex.stack}`);
            throw new Error(`${getFormattedDate()} | Exception while fetching markets, ex: ${ex}`);
        }
    }

    async connectToExchange(symbols = []) {
        if (!this.wsInitialized) {
            try {
                const markets = await this.getMarkets();
                const symbolsObj = markets.map(m => ({
                    symbol: `${m.base.replace('Bihu', 'KEY').replace('PCHAIN', 'PAI')}_${m.quote.replace('Bihu', 'KEY').replace('PCHAIN', 'PAI')}`,
                    base: m.base,
                    quote: m.quote
                })).filter(s => ((symbols.length === 0) ? true : symbols.includes(`${s.base}/${s.quote}`)));

                this.wsInitialized = true;

                this.initWS(symbolsObj);
            } catch (ex) {
                console.log(`${getFormattedDate()} | Exception while connecting to orderbooks ws, ex: ${ex}, stacktrace: ${ex.stack}`);
                throw new Error(`${getFormattedDate()} | Exception while connecting to orderbooks ws, ex: ${ex}`);
            }
        }
    }

    getOrderbooks({ symbols = [], limit = 1 } = {}) {
        try {
            let orderbooks = this.orderBooks; // should be filled from ws
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

    /**
     * Returns updated orderbooks for client. Also saves cache.
     * @param all
     * @param symbols
     * @param limit
     * @returns {Array}
     */
    getUpdatedOrderbooks(all = false, { symbols = [], limit = 1 }) {
        try {
            let result = [];
            const allOrderBooks = this.getOrderbooks({ symbols, limit });
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

    runOrderBookNotifier({ symbols = [], limit = 1 } = {}, callback) {
        if (!this.notifierRunning) {
            this.notifierRunning = true;

            this.notifireIntervalId = setInterval(() => {
                const start = +new Date();
                const updatedOrderBooks = this.getUpdatedOrderbooks(false, {
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
            this.rotateAgent();
            const orderRaw = await this.api.createOrder(
                symbol,
                'limit',
                operation,
                amount,
                price
            );

            const [ base, quote ] = symbol.split('/');

            const order = {
                id: orderRaw.id,
                base,
                quote,
                operation,
                amount,
                remain: amount,
                price,
                average: 0,
                created: +new Date(),
                status: 'active'
            };

            if (cancelAfter && cancelAfter > 0 && order.status !== 'closed') {
                setTimeout(async () => {
                    try {
                        await this.api.cancelOrder(order.id);
                        console.log(`${getFormattedDate()} | Order (id: ${order.id}) cancelled.`);
                    } catch (ex) {
                        console.log(`${getFormattedDate()} | Exception while canceling order with id: ${order.id}, ex: ${ex}, stacktrace: ${ex.stack}`);
                    }
                }, cancelAfter);
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
            this.rotateAgent();
            await this.api.cancelOrder(id);
        } catch (ex) {
            console.log(`${getFormattedDate()} | Exception while canceling order, orderId: '${id}', ex: ${ex}, stacktrace: ${ex.stack}`);
            throw new Error(`${getFormattedDate()} | Exception while canceling order, orderId: '${id}', ex: ${ex}`);
        }
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
            this.rotateAgent();

            await this.api.loadMarkets();
            const response = await this.api.privatePostOrderpending({
                cmd: 'orderpending/order',
                body: this.api.extend({
                    id,
                    account_type: 0
                }, {}),
            });
            const order = this.api.safeValue(response, 'result');
            if (this.api.isEmpty(order)) {
                throw new ccxt.OrderNotFound(`${this.api.id} order ${id} not found`);
            }

            const o = this.api.parseOrder(order);
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
                status: (o.status === 'open') ? 'active' : (o.status === '-1') ? 'canceled' : o.status
            };
        } catch (ex) {
            console.log(`${getFormattedDate()} | Exception while getting order, orderId: '${id}', ex: ${ex}, stacktrace: ${ex.stack}`);
            throw new Error(`${getFormattedDate()} | Exception while getting order, orderId: '${id}', ex: ${ex}`);
        }
    }
};