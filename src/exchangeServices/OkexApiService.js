const request = require('request-promise-native');
const Big = require('big.js');
const WebSocket = require('ws');
const pako = require('pako');
const OkexApi = require('./okex-v3');

const ExchangeServiceAbstract = require('./ExchangeServiceAbstract');
const { getPrices } = require('../utils/PriceUtil');

const WS_URL = 'wss://real.okex.com:10441/websocket?compress=true';

const convertToOrderbook = (rawOrderBook) => {
    const { asks, bids } = rawOrderBook;
    const res = {
        asks: [],
        bids: []
    };

    for (const ask of asks) {
        const [ price, amount ] = ask;
        res.asks.unshift({
            price: +price,
            amount: +amount
        });
    }

    for (const bid of bids) {
        const [ price, amount ] = bid;
        res.bids.push({
            price: +price,
            amount: +amount
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
        const [{ price: ask } = {}] = asks;
        const [{ price: bid } = {}] = bids;
        return {
            base,
            quote,
            ask,
            bid
        };
    })
);

const convertOrderStatus = (status) => {
    // (all, open, part_filled, canceling, filled, cancelled，ordering)
    switch (status) {
        case 'open':
        case 'part_filled':
            return 'active';
        case 'cancelling':
        case 'cancelled':
            return 'cancelled';
        case 'filled':
            return 'closed';
        default: return undefined;
    }
};

module.exports = class OkexApiService extends ExchangeServiceAbstract {
    constructor({ exchange, apiKey, apiSecret, passphrase, ipArray, mainCurrency, currencies }, orderbooksUpdatedCallback) {
        super({ exchange, ipArray, mainCurrency, currencies }, orderbooksUpdatedCallback);

        this.api = new OkexApi(apiKey, apiSecret, passphrase);

        this.orderBooks = [];
        this.orderBooksCache = undefined; // кэш ордербуков для клиента
        this.notifireIntervalId = undefined;

        this.initWS();
    }

    async initWS() {
        function subscribe(ws, symbols) {
            for (const symbol of symbols) {
                ws.send(JSON.stringify({
                    event: 'addChannel',
                    channel: `ok_sub_spot_${symbol.symbol}_depth_20`
                }));
            }
            console.log(`Subscribed to ${symbols.length} orderbook channels.`);
        }

        function handle(msg, callback) {
            const { channel, data } = msg;
            const channelArr = channel.split('_');
            const symbol = `${channelArr[3]}_${channelArr[4]}`;
            const channelType = channelArr[5];
            if (msg.binary === 0) {
                switch (channelType) {
                    case 'depth':
                        callback(symbol, data);
                        break;
                    default:
                        console.error('ws invalid channel, msg: ', msg);
                }
            }
        }

        function init(symbols, callback) {
            const ws = new WebSocket(WS_URL);

            ws.on('open', () => {
                console.log('open okex ws');
                subscribe(ws, symbols);
            });

            ws.on('message', (data) => {
                let msg;
                if (data instanceof String) {
                    console.log(`Message from websocket: ${data}`);
                } else {
                    try {
                        msg = JSON.parse(pako.inflateRaw(data, { to: 'string' }));
                    } catch (err) {
                        console.log(`Error while parsing ws message, err: ${err}`);
                    }
                }
                if (msg && msg[0]) {
                    handle(msg[0], callback);
                } else {
                    console.error('okex ws error ', msg);
                }
            });

            ws.on('close', () => {
                console.log('close okex ws');
                init(symbols, callback);
            });

            ws.on('error', (err) => {
                console.log('error on okex ws:', err);
                init(symbols, callback);
            });
        }

        const markets = await this.getMarkets();
        const symbols = markets.map(m => ({
            symbol: `${m.base.toLowerCase()}_${m.quote.toLowerCase()}`,
            base: m.base,
            quote: m.quote
        }));

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
            const raw = await request({
                url: 'https://www.okex.com/v2/spot/markets/products',
                json: true,
                localAddress: this.getNextIp(),
                timeout: 10000
            });

            if (raw && raw.data && raw.data.length > 0) {
                return raw.data.map((m) => {
                    const [ base, quote ] = m.symbol.split('_');

                    return {
                        base: base.toUpperCase(),
                        quote: quote.toUpperCase(),
                        precision: {
                            price: m.maxPriceDigit,
                            amount: m.maxSizeDigit
                        },
                        taker: 0.0020,
                        maker: 0.0015,
                        limits: {
                            amount: {
                                min: m.minTradeSize
                            },
                            price: {},
                            cost: {}
                        }
                    };
                });
            }

            console.log(`Exception while fetching markets, okex doesn't return data, response: ${raw}`);
            throw new Error(`Exception while fetching markets, okex doesn't return data, response: ${raw}`);
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

    getPrices(currencies = []) {
        try {
            const orderBooks = this.getOrderBooks({ limit: 1 });
            const tickers = convertOrderBooksToTickers(orderBooks);

            return getPrices(tickers, currencies, this.mainCurrency);
        } catch (ex) {
            console.log(`Exception while fetching prices, ex: ${ex}, stacktrace: ${ex.stack}`);
            throw new Error(`Exception while fetching prices, ex: ${ex}`);
        }
    }

    async getBalances(currencies = []) {
        try {
            let balances = await this.api.getBalances({ localAddress: this.getNextIp() });
            if (balances) {
                balances = balances.map(b => ({
                    currency: b.currency,
                    free: +b.available,
                    used: +b.hold,
                    total: +b.balance,
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
            }
            console.log('Exception while fetching balances, exchange doesn\'t return data.');
            throw new Error('Exception while fetching balances, exchange doesn\'t return data.');
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
            const orderRaw = await this.api.createOrder(
                symbol.replace('/', '-'),
                operation,
                price,
                amount,
                { localAddress: this.getNextIp() }
            );

            const orderRes = JSON.parse(orderRaw);
            const { order_id: orderId } = orderRes;

            if (orderId) {
                const [ base, quote ] = symbol.split('/');
                const order = {
                    id: orderId,
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
                            await this.api.cancelOrder(symbol.replace('/', '-'), order.id, { localAddress: this.getNextIp() });
                            console.log(`Order (id: ${order.id}) cancelled.`);
                        } catch (ex) {
                            console.log(`Exception while canceling order with id: ${order.id}, ex: ${ex}, stacktrace: ${ex.stack}`);
                        }
                    }, cancelAfter);
                }

                return order;
            }

            console.log(`Exception while creating order, exchange message: ${orderRes}`);
            throw new Error(`Exception while creating order, exchange message: ${orderRes}`);
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

        let result;
        try {
            await this.api.cancelOrder(symbol.replace('/', '-'), id, { localAddress: this.getNextIp() });
            result = { id, success: true };
        } catch (ex) {
            console.log(`Exception while canceling order, ex: ${ex}, stacktrace: ${ex.stack}`);
            result = { id, success: false, error: ex.message };
        }

        return result;
    }

    async getActiveOrders(symbol = '') {
        try {
            const openOrders = await this.api.getActiveOrders(
                symbol.replace('/', '-'),
                undefined,
                undefined,
                undefined,
                { localAddress: this.getNextIp() }
            ) || [];
            return openOrders.map((o) => {
                const {
                    order_id: id,
                    instrument_id: instrumentId,
                    side,
                    size,
                    filled_size: filled,
                    price,
                    timestamp
                } = o;
                const [ base, quote ] = instrumentId.split('-');

                return {
                    id,
                    base,
                    quote,
                    operation: side,
                    amount: +size,
                    remain: +Big(size).minus(filled),
                    price: +price,
                    average: (!(Big(o.filled_size).eq(0))) ? +Big(o.executed_value).div(o.filled_size) : 0,
                    created: +new Date(timestamp),
                    status: convertOrderStatus(o.status)
                };
            });
        } catch (ex) {
            if (ex.message.indexOf('30036') !== -1) { // okex возвращает 400 ошибку, когда ордеров нет
                return [];
            }

            console.log(`Exception while fetching active orders, ex: ${ex}, stacktrace: ${ex.stack}`);
            throw new Error(`Exception while fetching active orders, ex: ${ex}`);
        }
    }

    async getOrder({ symbol, id }) {
        if (!id || !symbol) {
            console.log('Exception while getting order, params missing');
            throw new Error('Exception while getting order, params missing');
        }

        let result;
        try {
            const o = await this.api.getOrder(symbol.replace('/', '-'), id, { localAddress: this.getNextIp() });
            result = {
                success: true,
                id: o.order_id,
                base: o.instrument_id.split('-')[0],
                quote: o.instrument_id.split('-')[1],
                operation: o.side,
                amount: +o.size,
                remain: +Big(o.size).minus(o.filled_size),
                price: +o.price,
                average: (!(Big(o.filled_size).eq(0))) ? +Big(o.executed_value).div(o.filled_size) : 0,
                created: +new Date(o.timestamp),
                status: convertOrderStatus(o.status)
            };
        } catch (ex) {
            console.log(`Exception while getting order, ex: ${ex}, stacktrace: ${ex.stack}`);
            result = { id, success: false, error: ex.message };
        }
        return result;
    }
};