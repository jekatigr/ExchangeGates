const https = require('https');
const ccxt = require('ccxt');
const BFX = require('bitfinex-api-node');

const ExchangeServiceAbstract = require('./ExchangeServiceAbstract');
const { makeChunks, getFormattedDate } = require('../utils/utils');

/**
 * Converts raw orderbooks from arrays to objects.
 * @param rawOrderBook
 */
const convertToOrderbook = (rawOrderBook) => {
    const { asks, bids } = rawOrderBook;
    const res = {
        asks: [],
        bids: []
    };

    for (const ask of asks) {
        const [ price, , amount ] = ask;
        res.asks.push({
            price,
            amount: -amount
        });
    }

    for (const bid of bids) {
        const [ price, , amount ] = bid;
        res.bids.push({
            price,
            amount
        });
    }

    return res;
};


module.exports = class BitfinexApiService extends ExchangeServiceAbstract {
    /**
     *
     * @param exchange
     * @param apiKey
     * @param apiSecret
     * @param ipArray
     * @param orderbooksUpdatedCallback - method which will be called after orderbooks update.
     */
    constructor({ exchange, apiKey, apiSecret, ipArray }, orderbooksUpdatedCallback) {
        super({ exchange, ipArray }, orderbooksUpdatedCallback);

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

        this.orderBooks = [];
        this.orderBooksCache = undefined; // client's orderbooks cache
        this.notifireIntervalId = undefined;
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

    async initWS(symbolsObj) {
        async function init(symbols, callback) {
            let isWSReconnecting = false;
            const bfx = new BFX({
                ws: {
                    autoReconnect: false,
                    seqAudit: true,
                    packetWDDelay: 10 * 1000
                }
            });

            const ws = bfx.ws(2, {
                manageOrderBooks: true, // enable candle dataset persistence/management
                transform: true // converts ws data arrays to Candle models (and others)
            });

            function subscribe(localWs, localSymbols, localCallback) {
                for (const symbolObj of localSymbols) {
                    localWs.subscribeOrderBook(symbolObj.symbol, 'P0', 100);
                    localWs.onOrderBook({ symbol: symbolObj.symbol }, (orderbook) => {
                        localCallback(symbolObj.symbol, orderbook);
                    });
                }
                console.log(`${getFormattedDate()} | Subscribed to Bitfinex ${localSymbols.length} orderbook channels.`);
            }

            function reconnect(localSymbols, localCallback) {
                if (!isWSReconnecting && (!ws || !ws.isOpen())) {
                    isWSReconnecting = true;
                    setTimeout(async () => {
                        await init(localSymbols, localCallback);
                    }, 10000);
                }
            }

            ws.on('open', async () => {
                console.log(`${getFormattedDate()} | Bitfinex ws socket opened`);
                subscribe(ws, symbols, callback);
            });

            ws.on('error', async (err) => {
                console.log(`${getFormattedDate()} | Bitfinex ws error, err: ${JSON.stringify(err)}`);
                try {
                    await ws.close();
                } catch (ex) {
                    console.log(`${getFormattedDate()} | Error: bitfinex ws already closed, ex: ${ex}`);
                }

                await reconnect(symbols, callback).bind(this);
            });

            ws.onMaintenanceStart(() => {
                console.log(`${getFormattedDate()} | Info: bitfinex ws maintenance period started`);
            });

            ws.onMaintenanceEnd(async () => {
                console.log(`${getFormattedDate()} | Info: bitfinex ws maintenance period ended`);

                try {
                    await ws.close();
                } catch (ex) {
                    console.log(`${getFormattedDate()} | Error: bitfinex ws already closed, ex: ${ex}`);
                }

                await reconnect(symbols, callback).bind(this);
            });

            ws.onServerRestart(async () => {
                console.log(`${getFormattedDate()} | Info: bitfinex ws server restarted`);
                try {
                    await ws.close();
                } catch (ex) {
                    console.log(`${getFormattedDate()} | Error: bitfinex ws already closed, ex: ${ex}`);
                }

                await reconnect(symbols, callback).bind(this);
            });

            ws.on('close', async () => {
                console.log(`${getFormattedDate()} | Info: bitfinex ws server closed`);
                try {
                    await ws.close();
                } catch (ex) {
                    console.log(`${getFormattedDate()} | Error: bitfinex ws already closed, ex: ${ex}`);
                }
                await reconnect(symbols, callback).bind(this);
            });

            ws.open();
            isWSReconnecting = false;
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

        const symbolsSplitted = makeChunks(symbolsObj, 30);
        for (const chunk of symbolsSplitted) {
            init(chunk, saveLocalDepth.bind(this));
        }
    }

    async getMarkets() {
        try {
            this.rotateAgent2();
            const markets = await this.api2.loadMarkets();

            const res = [];
            for (const marketId of Object.keys(markets)) {
                const market = markets[marketId];
                const { base, quote, precision, taker, maker, limits, active } = market;
                if (active) {
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
                this.rotateAgent2();
                const markets = await this.api2.loadMarkets();
                const symbolsObj = Object.values(markets).map(m => ({
                    symbol: m.id,
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
                        await this.api1.cancelOrder(order.id);
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
            this.rotateAgent1();
            await this.api1.cancelOrder(id, { localAddress: super.getNextIp() });
        } catch (ex) {
            console.log(`${getFormattedDate()} | Exception while canceling order, ex: ${ex}, stacktrace: ${ex.stack}`);
            throw new Error(`${getFormattedDate()} | Exception while canceling order, orderId: '${id}', ex: ${ex}`);
        }
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
            this.rotateAgent1();
            const o = await this.api1.fetchOrder(id);
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
            console.log(`${getFormattedDate()} | Exception while getting order, orderId: '${id}', ex: ${ex}, stacktrace: ${ex.stack}`);
            throw new Error(`${getFormattedDate()} | Exception while getting order, orderId: '${id}', ex: ${ex}`);
        }
    }

    async getDepositAddress(currency) {
        if (!currency) {
            console.log(`${getFormattedDate()} | Exception while getting deposit address, currency missing`);
            throw new Error(`${getFormattedDate()} | Exception while getting deposit address, currency missing`);
        }

        try {
            this.rotateAgent1();
            const res = await this.api1.fetchDepositAddress(currency);
            const { address } = res;
            return address;
        } catch (ex) {
            console.log(`${getFormattedDate()} | Exception while fetching deposit address, ex: ${ex}, stacktrace: ${ex.stack}`);
            throw new Error(`${getFormattedDate()} | Exception while fetching deposit address, ex: ${ex}`);
        }
    }

    async withdraw({ currency, address, amount }) {
        if (!currency) {
            console.log(`${getFormattedDate()} | Exception while making withdraw, currency missing`);
            throw new Error(`${getFormattedDate()} | Exception while making withdraw, currency missing`);
        }
        if (!address) {
            console.log(`${getFormattedDate()} | Exception while making withdraw, address missing`);
            throw new Error(`${getFormattedDate()} | Exception while making withdraw, address missing`);
        }
        if (!amount) {
            console.log(`${getFormattedDate()} | Exception while making withdraw, amount missing`);
            throw new Error(`${getFormattedDate()} | Exception while making withdraw, amount missing`);
        }

        try {
            this.rotateAgent1();
            const res = await this.api1.withdraw(currency, +amount, address);
            const { id } = res;
            return id;
        } catch (ex) {
            console.log(`${getFormattedDate()} | Exception while making withdraw, ex: ${ex}, stacktrace: ${ex.stack}`);
            throw new Error(`${getFormattedDate()} | Exception while making withdraw, ex: ${ex}`);
        }
    }
};