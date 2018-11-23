const request = require('request-promise-native');
const WebSocket = require('ws');
const pako = require('pako');

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

module.exports = class OkexApiService extends ExchangeServiceAbstract {
    constructor() {
        const config = getConfig();
        const { exchange, apiKey, apiSecret, ipArray } = config;

        super(exchange, ipArray);

        this.orderBooks = [];
        this.orderBooksCache = undefined; // кэш ордербуков для клиента
        this.notifireIntervalId = undefined;

        this.initWS();
    }

    async initWS() {
        function subscribe(ws, symbols) {
            for (const symbol of symbols) {
                ws.send(JSON.stringify({
                    event: "addChannel",
                    channel: 'ok_sub_spot_' + symbol.symbol + '_depth_20'
                }));
            }
            console.log(`Subscribed to ${symbols.length} orderbook channels.`);
        }

        function handle(msg, callback) {
            let channel = msg.channel;
            let data = msg.data;
            let channelArr = channel.split('_');
            let symbol = channelArr[3] + '_' + channelArr[4];
            let channelType = channelArr[5];
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
                    console.log('Message from websocket: ' + data);
                } else {
                    try {
                        msg = JSON.parse(pako.inflateRaw(data, {to: 'string'}));
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
                return raw.data.map(m => {
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
                    }
                });
            }

            console.log(`Exception while fetching markets, okex doesn't return data, response: ${raw}`);
            throw new Error(`Exception while fetching markets, okex doesn't return data, response: ${raw}`);
        } catch (ex) {
            console.log(`Exception while fetching markets, ex: ${ex}, stacktrace: ${ex.stack}`);
            throw new Error(`Exception while fetching markets, ex: ${ex}`);
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