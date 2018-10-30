const https = require ('https');
const ccxt = require('ccxt');
const request = require('request-promise-native');
const WebSocket = require('ws');
const pako = require('pako');

const ExchangeServiceAbstract = require('./ExchangeServiceAbstract');
const fillBalancesWithMainAmount = require('../utils/BalancesUtil');
const { getPrices } = require('../utils/PriceUtil');
const AdjacencyMatrixUtil = require('../utils/AdjacencyMatrixUtil');
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

module.exports = class HuobiApiService extends ExchangeServiceAbstract {
    constructor() {
        const config = getConfig();
        const { exchange, apiKey, apiSecret, ipArray } = config;

        super(exchange, ipArray);

        this.api = new ccxt.huobipro({
            apiKey: apiKey,
            secret: apiSecret,
            enableRateLimit: false,
            timeout: 10000
        });

        this.orderBooks = [];
        this.orderBooksCache = undefined; //кэш ордербуков для клиента
        this.notifierParams = undefined;

        this.initWS();
    }

    rotateAgent() {
        this.api.agent = https.Agent({
            localAddress: this.getNextIp()
        });
    }

    async initWS() {
        function subscribe(ws, symbols) {
            for (let symbol of symbols) {
                ws.send(JSON.stringify({
                    "sub": `market.${symbol.symbol}.depth.step0`,
                    "id": `${symbol.symbol}`
                }));
            }
        }

        function handle(data, callback) {
            let symbol = data.ch.split('.')[1];
            let channel = data.ch.split('.')[2];
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
                let text = pako.inflate(data, { to: 'string' });
                let msg = JSON.parse(text);
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

            ws.on('error', err => {
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
            this.sendUpdatedOrderBooksIfNeeded(base, quote);
        };

        init(symbols, saveLocalDepth.bind(this));
    }


    async getMarkets() {
        try {
            this.rotateAgent();
            const markets = await this.api.loadMarkets();

            const res = [];
            for (let marketId in markets) {
                let market = markets[marketId];
                const { base, quote, precision, taker, maker, limits } = market;
                res.push({
                    base,
                    quote,
                    precision,
                    taker,
                    maker,
                    limits
                })
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

    async runOrderBookNotifier({ symbols = [], limit = 1 } = {}, callback) {
        if (!this.notifierRunning) {
            const orderBooks = this.getOrderBooks({symbols, limit}); // отправляем все ордербуки после начала нотификации
            callback(undefined, {
                timestampStart: +new Date(),
                timestampEnd: +new Date(),
                data: orderBooks
            });

            this.notifierRunning = true;
            this.notifierParams = {
                symbols,
                limit,
                callback
            };
        }
    }

    sendUpdatedOrderBooksIfNeeded(base, quote) {
        if (this.notifierRunning && this.notifierParams) {
            if (!this.notifierParams.symbols
                || this.notifierParams.symbols.length === 0
                || this.notifierParams.symbols.includes(`${base}/${quote}`)
            ) {
                const start = +new Date();
                const updatedOrderBooks = this.getUpdatedOrderBooks(false, {
                    symbols: [`${base}/${quote}`],
                    limit: this.notifierParams.limit
                });

                if (this.notifierRunning && updatedOrderBooks && updatedOrderBooks.length > 0) {
                    this.notifierParams.callback(undefined, {
                        timestampStart: start,
                        timestampEnd: +new Date(),
                        data: updatedOrderBooks
                    });
                }
            }
        }
    }

    stopOrderBookNotifier() {
        this.notifierRunning = false;
        this.notifierParams = undefined;
        this.orderBooksCache = undefined;
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

    // async getPrices(currencies = []) {
    //     try {
    //         const { mainCurrency } = getConfig();
    //         const tickersRaw = JSON.parse(await request({url: HUOBI_TICKERS_API_URL, localAddress: this.getNextIp()}));
    //         const markets = await this.api.loadMarkets();
    //         const tickers = await this.api.marketGetTickers();
    //
    //         return getPrices(tickers, currencies, mainCurrency);
    //     } catch (ex) {
    //         console.log(`Exception while fetching prices, ex: ${ex}, stacktrace: ${ex.stack}`);
    //         throw new Error(`Exception while fetching prices, ex: ${ex}`);
    //     }
    // }
};