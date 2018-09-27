const request = require('request-promise-native');

const Market = require('./models/Market');
const Ticker = require('./models/Ticker');
const OrderBook = require('./models/OrderBook');
const Trades = require('./models/Trades');
const Trade = require('./models/Trade');

const PUBLIC_API_URL = 'https://api.tidex.com/api/3';
const PRIVATE_API_URL = ' https://api.tidex.com/tapi';

const get = async (method, queryString = '') => {
    try {
        return await request({
            method: 'GET',
            url: `${PUBLIC_API_URL}/${method}/${queryString}`,
            headers: {
                Connection: 'keep-alive'
            },
            gzip: true,
            json: true
        });
    } catch (ex) {
        console.log(`Exception for '${method}' method request, params: ${JSON.stringify(params)}, ex: ${ex}`);
    }
};

/**
 *
 * @param symbol Торговая пара, например: 'BTC/WEUR';
 */
const convertSymbolToTidexPairString = (symbol) => {
    let s = symbol.split('/');
    return `${s[0].toLowerCase()}_${s[1].toLowerCase()}`;
};

module.exports = class TidexApi {
    constructor({ apiKey, apiSecret } = {}) {
        this.apiKey = apiKey;
        this.apiSecret = apiSecret;

        this.markets = undefined;
    }

    async _getQueryString(symbols = []) {
        let toConvert = symbols;
        if (toConvert.length === 0) {
            let markets = await this.getMarkets();
            toConvert = markets.map(m => `${m.base}/${m.quote}`);
        }
        toConvert = toConvert.map(s => convertSymbolToTidexPairString(s));

        return toConvert.join('-');
    }

    async getMarkets() {
        if (!this.markets) {
            const res = await get('info');

            const { pairs } = res;

            const markets = [];

            for (const key of Object.keys(pairs)) {
                const m = pairs[key];
                if (m.hidden !== 1) {
                    const symbol = key.split('_');
                    markets.push(new Market({
                        base: symbol[0].toUpperCase(),
                        quote: symbol[1].toUpperCase(),
                        precision: m.decimal_places,
                        fee: m.fee,
                        minPrice: m.min_price,
                        minAmount: m.min_amount,
                        maxPrice: m.max_price,
                        maxAmount: m.max_amount,
                        minTotal: m.min_total
                    }));
                }
            }

            this.markets = markets;
        }
        return this.markets;
    }

    /**
     * Возвращает тикеры к указанным торговым парам.
     * @param symbols Массив валютных пар, например: [
     *      ETH/BTC,
     *      BTC/WEUR
     * ].
     * Если параметр опущен, возвращаются все тикеры по всем доступным парам.
     * @returns Массив тикеров.
     */
    async getTickers(symbols = []) {
        const queryString = await this._getQueryString(symbols);

        const source = await get('ticker', queryString);

        const tickers = [];
        for (const key of Object.keys(source)) {
            const t = source[key];
            const symbol = key.split('_');
            tickers.push(new Ticker({
                base: symbol[0].toUpperCase(),
                quote: symbol[1].toUpperCase(),
                ask: t.sell,
                bid: t.buy,
                last: t.last,
                high: t.high,
                low: t.low,
                avg: t.avg,
                baseVolume: t.vol_cur,
                quoteVolume: t.vol
            }));
        }

        return tickers;
    }

    /**
     * Возвращает ордербуки к указанным торговым парам.
     * @param limit количество ордеров в ордербуке, максимиум 2000, по-умолчанию 150.
     * @param symbols Массив валютных пар, например: [
     *      ETH/BTC,
     *      BTC/WEUR
     * ].
     * Если параметр опущен, возвращаются все ордербуки по всем доступным парам.
     * @returns Массив ордербуков, где asks и bids - массивы массивов, в каждом из которых [0] - price, [1] - цена
     */
    async getOrderBooks({ limit, symbols = [] } = { symbols: [] }) {
        let queryString = await this._getQueryString(symbols);

        if (limit) {
            if (limit > 2000) {
                throw new Error('Max limit for orderbook is 2000.');
            }
            queryString += `?limit=${limit}`;
        }

        const source = await get('depth', queryString);

        const orderBooks = [];
        for (const key of Object.keys(source)) {
            const o = source[key];
            const symbol = key.split('_');
            orderBooks.push(new OrderBook({
                base: symbol[0].toUpperCase(),
                quote: symbol[1].toUpperCase(),
                asks: o.asks,
                bids: o.bids
            }));
        }

        return orderBooks;
    }

    /**
     * Возвращает последние сделки к указанным торговым парам.
     * @param limit количество сделок в результате, максимиум 2000, по-умолчанию 150.
     * @param symbols Массив валютных пар, например: [
     *      ETH/BTC,
     *      BTC/WEUR
     * ].
     * Если параметр опущен, возвращаются все последние по всем доступным парам.
     * @returns Массив сделок
     */
    async getTrades({ limit, symbols = [] } = { symbols: [] }) {
        let queryString = await this._getQueryString(symbols);

        if (limit) {
            if (limit > 2000) {
                throw new Error('Max limit for trades is 2000.');
            }
            queryString += `?limit=${limit}`;
        }

        const source = await get('trades', queryString);

        const trades = [];
        for (const key of Object.keys(source)) {
            const t = source[key];
            const symbol = key.split('_');

            const tradesArray = [];

            t.forEach(tr => {
                tradesArray.push(new Trade({
                    operation: tr.type === "ask" ? 'sell' : 'buy',
                    amount: tr.amount,
                    price: tr.price,
                    timestamp: tr.timestamp
                }));
            });

            trades.push(new Trades({
                base: symbol[0].toUpperCase(),
                quote: symbol[1].toUpperCase(),
                trades: tradesArray
            }));
        }

        return trades;
    }
};