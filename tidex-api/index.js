const request = require('request-promise-native');
const crypto = require("crypto");
const querystring = require('querystring');

const Market = require('./models/Market');
const Ticker = require('./models/Ticker');
const OrderBook = require('./models/OrderBook');
const Trades = require('./models/Trades');
const Trade = require('./models/Trade');
const AccountInfo = require('./models/AccountInfo');
const Balance = require('./models/Balance');
const Order = require('./models/Order');

const PUBLIC_API_URL = 'https://api.tidex.com/api/3';
const PRIVATE_API_URL = ' https://api.tidex.com/tapi';

const get = async (method, queryString = '') => {
    try {
        return await request({
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

function sign(key, str) {
    const hmac = crypto.createHmac("sha512", key);
    return hmac.update(new Buffer(str, 'utf-8')).digest("hex");
}

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

    async privateRequest(method, params = {}) {
        try {
            const body = {
                ...params,
                method,
                nonce: params.nonce || 1
            };

            const body_converted = querystring.stringify(body);
            const signed = sign(this.apiSecret, body_converted);
            const res = await request({
                method: 'POST',
                url: `${PRIVATE_API_URL}`,
                headers: {
                    Connection: 'keep-alive',
                    Key: this.apiKey,
                    Sign: signed
                },
                gzip: true,
                body: body_converted
            });
            return JSON.parse(res);
        } catch (ex) {
            console.log(`Exception for private method '${method}' request, params: ${JSON.stringify(params)}, ex: ${ex}`);
        }
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

    /**
     * Возвращает инфо по аккаунту, балансы не распределяются на free и used, указывается только total.
     * @returns AccountInfo
     */
    async getAccountInfo() {
        const res = await this.privateRequest('getInfo');

        if (res.success) {
            const funds = res.return.funds;
            const balances = [];

            for (const key of Object.keys(funds)) {
                if (funds[key] > 0) {
                    balances.push(new Balance({
                        currency: key.toUpperCase(),
                        total: funds[key]
                    }));
                }
            }

            return new AccountInfo({
                balances,
                openOrdersCount: res.return.open_orders,
                rights: res.return.rights
            });
        } else {
            throw new Error(`Error from exchange, error: '${res.error}'`);
        }
    }

    /**
     * Возвращает инфо по аккаунту, балансы распределяются на free и used.
     * @returns AccountInfo
     */
    async getAccountInfoExtended() {
        const res = await this.privateRequest('getInfoExt');

        if (res.success) {
            const funds = res.return.funds;
            const balances = [];

            for (const key of Object.keys(funds)) {
                const { value, inOrders } = funds[key];
                if (value > 0 || inOrders > 0) {
                    balances.push(new Balance({
                        currency: key.toUpperCase(),
                        free: value,
                        used: inOrders
                    }));
                }
            }

            return new AccountInfo({
                balances,
                openOrdersCount: res.return.open_orders,
                rights: res.return.rights
            });
        } else {
            throw new Error(`Error from exchange, error: '${res.error}'`);
        }
    }

    /**
     * Возвращает массив открытых ордеров.
     * @param symbol валютная пара, например: 'ETH/BTC'.
     * Если параметр опущен, возвращаются все активные ордера.
     * @returns Массив с элементами типа Order.
     */
    async getActiveOrders(symbol) {
        let params;
        if (symbol) {
            params = { pair: convertSymbolToTidexPairString(symbol) }
        }
        const res = await this.privateRequest('ActiveOrders', params);

        if (res.success) {
            const orders = res.return;
            const activeOrders = [];

            for (const key of Object.keys(orders)) {
                const { pair, type, amount, rate, timestamp_created } = orders[key];
                const symbol = pair.split('_');
                activeOrders.push(new Order({
                    id: +key,
                    base: symbol[0].toUpperCase(),
                    quote: symbol[1].toUpperCase(),
                    operation: type,
                    amount,
                    price: rate,
                    created: timestamp_created,
                    status: 'active'
                }));
            }

            return activeOrders;
        } else {
            throw new Error(`Error from exchange, error: '${res.error}'`);
        }
    }

    /**
     * Возвращает информацию об ордеру.
     * Если параметр опущен, возвращаются все активные ордера.
     * @param orderId id ордера.
     * @returns Order.
     */
    async getOrder(orderId) {
        if (!orderId) {
            throw new Error('Order id is required for getOrder method.');
        }
        const res = await this.privateRequest('OrderInfo', { order_id: orderId });

        if (res.success) {
            const orderRaw = res.return;
            const [ id ] = Object.keys(orderRaw);
            const { pair, type, start_amount, amount, rate, timestamp_created, status } = orderRaw[id];

            let statusStr;
            switch (status) {
                case 0: { statusStr = 'active'; break; }
                case 1: { statusStr = 'closed'; break; }
                case 2: { statusStr = 'cancelled'; break; }
                case 3: { statusStr = 'cancelled_partially'; break; }
            }

            const symbol = pair.split('_');
            return new Order({
                id: +id,
                base: symbol[0].toUpperCase(),
                quote: symbol[1].toUpperCase(),
                operation: type,
                amount: start_amount,
                remain: amount,
                price: rate,
                created: timestamp_created,
                status: statusStr
            });
        } else {
            throw new Error(`Error from exchange, error: '${res.error}'`);
        }
    }
};