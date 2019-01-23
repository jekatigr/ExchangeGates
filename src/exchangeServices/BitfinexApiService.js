const https = require('https');
const ccxt = require('ccxt');
const Big = require('big.js');
const BFX = require('bitfinex-api-node');

const { getPrices } = require('../utils/PriceUtil');
const ExchangeServiceAbstract = require('./ExchangeServiceAbstract');

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
    constructor({ exchange, apiKey, apiSecret, ipArray, mainCurrency, currencies }) {
        super({ exchange, ipArray, mainCurrency, currencies });

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
        this.orderBooksCache = undefined; // кэш ордербуков для клиента
        this.notifireIntervalId = undefined;

        this.initWS();
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

    async initWS() {
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
                console.log(`Subscribed to ${localSymbols.length} orderbook channels.`);
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
                console.log('bitfinex ws socket opened');
                subscribe(ws, symbols, callback);
            });

            ws.on('error', async (err) => {
                console.log(`web socket error, err: ${JSON.stringify(err)}`);
                try {
                    await ws.close();
                } catch (ex) {
                    console.log(`error: ws already closed, ex: ${ex}`);
                }

                await reconnect(symbols, callback).bind(this);
            });

            ws.onMaintenanceStart(() => {
                console.log('info: ws maintenance period started');
            });

            ws.onMaintenanceEnd(async () => {
                console.log('info: ws maintenance period ended');

                try {
                    await ws.close();
                } catch (ex) {
                    console.log(`error: ws already closed, ex: ${ex}`);
                }

                await reconnect(symbols, callback).bind(this);
            });

            ws.onServerRestart(async () => {
                console.log('info: ws bitfinex server restarted');
                try {
                    await ws.close();
                } catch (ex) {
                    console.log(`error: ws already closed, ex: ${ex}`);
                }

                await reconnect(symbols, callback).bind(this);
            });

            ws.on('close', async () => {
                console.log('info: ws bitfinex server closed');
                try {
                    await ws.close();
                } catch (ex) {
                    console.log(`error: ws already closed, ex: ${ex}`);
                }
                await reconnect(symbols, callback).bind(this);
            });

            ws.open();
            isWSReconnecting = false;
        }

        this.rotateAgent2();
        const markets = await this.api2.loadMarkets();
        const symbols = Object.values(markets).map(m => ({
            symbol: m.id,
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
        };

        init(symbols.slice(0, Math.floor(symbols.length / 2)), saveLocalDepth.bind(this));
        init(symbols.slice(Math.floor(symbols.length / 2) + 1, symbols.length), saveLocalDepth.bind(this));
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

    async getTriangles() {
        try {
            const markets = await this.getMarkets();

            return ExchangeServiceAbstract.calculateTriangles(this.currencies, markets);
        } catch (ex) {
            console.log(`Exception while fetching triangles, ex: ${ex}, stacktrace: ${ex.stack}`);
            throw new Error(`Exception while fetching triangles, ex: ${ex}`);
        }
    }

    async getPrices(currencies = []) {
        try {
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
            return getPrices(tickers, currencies, this.mainCurrency);
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
                        await this.api1.cancelOrder(order.id);
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