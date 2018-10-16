const TidexApi = require('node-tidex-api');
const fillBalancesWithMainAmount = require('./BalancesUtil');
const { getPrices } = require('./PriceUtil');
const AdjacencyMatrixUtil = require('./AdjacencyMatrixUtil');
const { getConfig } = require('./ConfigLoader');

/**
 * Возвращает только обновленные ордербуки.
 * @param allOrderBooks новые ордербуки
 * @param orderBooksCache существующие ордербуки в кэше
 */
const filterChangedOrderBooks = (allOrderBooks, orderBooksCache) => {
    const result = [];
    allOrderBooks.forEach((orderBook) => {
        const [cached] = orderBooksCache.filter(c => c.base === orderBook.base && c.quote === orderBook.quote);
        if (!cached) {
            result.push(orderBook);
        } else {
            const { asks: cachedAsks, bids: cachedBids } = cached;
            const { asks, bids } = orderBook;
            if (asks.length !== cachedAsks.length || bids.length !== cachedBids.length) {
                result.push(orderBook);
            } else { // длина массиво асков и бидов одинакова
                let changed = false;
                for (let i = 0; i < asks.length && !changed; i++) {
                    if (asks[i].price !== cachedAsks[i].price || asks[i].amount !== cachedAsks[i].amount) {
                        changed = true;
                    }
                }

                for (let i = 0; i < bids.length && !changed; i++) {
                    if (bids[i].price !== cachedBids[i].price || bids[i].amount !== cachedBids[i].amount) {
                        changed = true;
                    }
                }

                if (changed) {
                    result.push(orderBook);
                }
            }
        }
    });
    return result;
};

module.exports = class TidexApiService {
    constructor() {
        const config = getConfig();
        const { apiKey, apiSecret } = config;

        this.api = new TidexApi({
            apiKey,
            apiSecret
        });

        this.orderBooksCache = undefined;
    }

    async getMarkets() {
        try {
            return await this.api.getMarkets();
        } catch (ex) {
            console.log(`Exception while fetching markets, ex: ${ex}, stacktrace: ${ex.stack}`);
            throw new Error(`Exception while fetching markets, ex: ${ex}`);
        }
    }

    async getBalances(currencies = []) {
        try {
            const { mainCurrency } = getConfig();
            const { balances } = await this.api.getAccountInfoExtended();
            const tickers = await this.api.getTickers() || [];

            const balancesFiltered = (currencies.length > 0)
                ? balances.filter(b => currencies.includes(b.currency))
                : balances;

            return fillBalancesWithMainAmount(balancesFiltered, tickers, mainCurrency);
        } catch (ex) {
            console.log(`Exception while fetching balances, ex: ${ex}, stacktrace: ${ex.stack}`);
            throw new Error(`Exception while fetching balances, ex: ${ex}`);
        }
    }

    async getOrderBooks({ symbols = [], limit = 1 } = {}) {
        try {
            let symbolsArr = symbols;
            if (symbolsArr.length === 0) {
                const markets = await this.api.getMarkets();
                symbolsArr = markets.map(m => `${m.base}/${m.quote}`);
            }
            return this.api.getOrderBooks({ limit, symbols: symbolsArr });
        } catch (ex) {
            console.log(`Exception while fetching orderbooks, ex: ${ex}, stacktrace: ${ex.stack}`);
            throw new Error(`Exception while fetching orderbooks, ex: ${ex}`);
        }
    }

    async getUpdatedOrderBooks(all = false, { symbols = [], limit = 1 }) {
        try {
            let result = [];
            const allOrderBooks = await this.getOrderBooks({ symbols, limit });
            if (!all && this.orderBooksCache) {
                result = filterChangedOrderBooks(allOrderBooks, this.orderBooksCache);
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

    async getTriangles() {
        try {
            const config = getConfig();
            const { currencies } = config;

            const markets = await this.api.getMarkets();

            // создаем матрицу смежности
            const matrix = AdjacencyMatrixUtil.fillAdjacencyMatrixForCurrencies(markets, currencies);

            const triangles = [];

            for (let a = 0; a < currencies.length; a++) {
                for (let b = a + 1; b < currencies.length; b++) {
                    if (matrix[a][b] !== 0) {
                        for (let c = b + 1; c < currencies.length; c++) {
                            if (matrix[b][c] === 1 && matrix[a][c] === 1) {
                                triangles.push([ currencies[a], currencies[b], currencies[c] ]);
                                triangles.push([ currencies[a], currencies[c], currencies[b] ]);
                                triangles.push([ currencies[b], currencies[a], currencies[c] ]);
                                triangles.push([ currencies[b], currencies[c], currencies[a] ]);
                                triangles.push([ currencies[c], currencies[a], currencies[b] ]);
                                triangles.push([ currencies[c], currencies[b], currencies[a] ]);
                            }
                        }
                    }
                }
            }

            return triangles;
        } catch (ex) {
            console.log(`Exception while fetching triangles, ex: ${ex}, stacktrace: ${ex.stack}`);
            throw new Error(`Exception while fetching triangles, ex: ${ex}`);
        }
    }

    async getPrices(currencies = []) {
        try {
            const { mainCurrency } = getConfig();
            const tickers = await this.api.getTickers() || [];

            return getPrices(tickers, currencies, mainCurrency);
        } catch (ex) {
            console.log(`Exception while fetching prices, ex: ${ex}, stacktrace: ${ex.stack}`);
            throw new Error(`Exception while fetching prices, ex: ${ex}`);
        }
    }

    async createOrder(params = {}) {
        const { symbol, operation, price, amount, cancelAfter } = params;

        if (!symbol || !operation || !price || !amount) {
            console.log('Exception while creating order, params missing');
            throw new Error('Exception while creating order, params missing');
        }

        try {
            const order = await this.api.limitOrder(symbol, price, amount, operation);

            if (cancelAfter && cancelAfter > 0 && order.status !== 'closed') {
                setTimeout(async () => {
                    try {
                        await this.api.cancelOrder(order.id);
                        console.log(`Order (id: ${order.id}) cancelled.`);
                    } catch (ex) {
                        console.log(`Exception while canceling order with id: ${order.id}, ex: ${ex}, stacktrace: ${ex.stack}`);
                    }
                }, cancelAfter);
            }

            return order;
        } catch (ex) {
            console.log(`Exception while creating order, ex: ${ex}, stacktrace: ${ex.stack}`);
            throw new Error(`Exception while creating order, ex: ${ex}`);
        }
    }
};