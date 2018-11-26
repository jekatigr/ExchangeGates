//const util = require('util');
const request = require('request-promise-native');
const Big = require('big.js');
const WebSocket = require('ws');
const pako = require('pako');
const OkexApi = require('./okex-v3');

const ExchangeServiceAbstract = require('./ExchangeServiceAbstract');
const { getPrices } = require('../utils/PriceUtil');
const { getConfig } = require('../ConfigLoader');

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

module.exports = class OkexApiService extends ExchangeServiceAbstract {
    constructor() {
        const config = getConfig();
        const { exchange, apiKey, apiSecret, passphrase, ipArray } = config;

        super(exchange, ipArray);

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
            const options = {
                localAddress: this.getNextIp()
            };
            let balances = await this.api.getBalances(options);
            if (balances && balances.length > 0) {
                balances = balances.map((b) => {
                    return {
                        currency: b.currency,
                        free: +b.available,
                        used: +b.hold,
                        total: +b.balance,
                    }
                });

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
};