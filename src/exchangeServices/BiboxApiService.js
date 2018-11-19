const https = require('https');
const ccxt = require('ccxt');
const WebSocket = require('ws');
const pako = require('pako');

const ExchangeServiceAbstract = require('./ExchangeServiceAbstract');
const { getPrices } = require('../utils/PriceUtil');
const { getConfig } = require('../ConfigLoader');

const WS_URL = 'wss://push.bibox.com/';

/**
 * Конвертер ордербуков в общий формат объектов
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
    constructor() {
        const config = getConfig();
        const { exchange, apiKey, apiSecret, ipArray } = config;

        super(exchange, ipArray);

        this.api = new ccxt.bibox({
            apiKey,
            secret: apiSecret,
            enableRateLimit: false,
            timeout: 10000
        });

        this.orderBooks = [];
        this.orderBooksCache = undefined; // кэш ордербуков для клиента

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
                    event: "addChannel",
                    channel: 'bibox_sub_spot_' + symbol.symbol + '_depth'
                }));
            }
            console.log(`Subscribed to ${symbols.length} orderbook channels.`);
        }

        function handle(msg, callback) {
            let channel = msg.channel;
            let data = msg.data;
            let text = pako.inflate(Buffer.from(data, 'base64'), {
                to: 'string'
            });

            let recvMsg = JSON.parse(text);
            let channelArr = channel.split('_');
            let symbol = channelArr[3] + '_' + channelArr[4];
            let channelType = channelArr[5];
            switch (channelType) {
                case 'depth':
                    callback(symbol, recvMsg);
                    break;
                default:
                    console.error('ws invalid channel, msg: ', msg);
            }
        }

        function init(symbols, callback) {
            const ws = new WebSocket(WS_URL);

            ws.on('open', () => {
                console.log('open bibox ws');
                subscribe(ws, symbols);
            });

            ws.on('message', (data) => {
                let msg = JSON.parse(data);
                if (msg[0]) {
                    handle(msg[0], callback);
                } else {
                    console.error('bibox ws error ', msg);
                }
            });

            ws.on('close', () => {
                console.log('close bibox ws');
                init(symbols, callback);
            });

            ws.on('error', (err) => {
                console.log('error on bibox ws:', err);
                init(symbols, callback);
            });
        }

        const markets = await this.getMarkets();
        const symbols = markets.map(m => ({
            symbol: `${m.base.replace('Bihu', 'KEY').replace('PCHAIN', 'PAI')}_${m.quote.replace('Bihu', 'KEY').replace('PCHAIN', 'PAI')}`,
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
};