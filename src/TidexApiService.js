const TidexApi = require('node-tidex-api');
const { getConfig } = require('./ConfigLoader');

/**
 * Фильрует балансы в соответствии с файлом конфига.
 */
const filterBalances = (balances = []) => {
    const config = getConfig();
    const { currencies } = config;
    return balances.filter(b => currencies.includes(b.currency));
};

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

        this.actualSymbols = undefined;
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

    async getBalances() {
        try {
            const { balances } = await this.api.getAccountInfoExtended();

            const balancesFiltered = filterBalances(balances);

            return balancesFiltered;
        } catch (ex) {
            console.log(`Exception while fetching balances, ex: ${ex}, stacktrace: ${ex.stack}`);
            throw new Error(`Exception while fetching balances, ex: ${ex}`);
        }
    }

    async getOrderBooks() {
        const symbols = await this.getActualSymbols();
        return this.api.getOrderBooks({ limit: 1, symbols });
    }

    async getUpdatedOrderBooks(all = false) {
        let result = [];
        try {
            const allOrderBooks = await this.getOrderBooks();
            if (!all && this.orderBooksCache) {
                result = filterChangedOrderBooks(allOrderBooks, this.orderBooksCache);
            } else {
                result = allOrderBooks;
            }
            this.orderBooksCache = allOrderBooks;
        } catch (ex) {
            console.log(`Exception while fetching updated orderbooks, ex: ${ex}, stacktrace: ${ex.stack}`);
            throw new Error(`Exception while fetching updated orderbooks, ex: ${ex}`);
        }
        return result;
    }

    /**
     * Возвращает символы, которые нужно будет отслеживать в ордербуках.
     * @returns {Promise<Array>}
     */
    async getActualSymbols() {
        if (!this.actualSymbols) {
            const config = getConfig();
            const { currencies } = config;
            const markets = await this.api.getMarkets();

            this.actualSymbols = [];
            for (const m of markets) {
                const baseIndex = currencies.findIndex(c => c === m.base);
                const quoteIndex = currencies.findIndex(c => c === m.quote);
                if (baseIndex !== -1 && quoteIndex !== -1) {
                    this.actualSymbols.push(`${m.base}/${m.quote}`);
                }
            }
        }
        return this.actualSymbols;
    }

    async getTriangles() {
        try {
            const config = getConfig();
            const { currencies } = config;

            // создаем матрицу смежности
            const matrix = new Array(currencies.length);
            for (let i = 0; i < currencies.length; i++) {
                matrix[i] = new Array(currencies.length);
                for (let j = 0; j < currencies.length; j++) {
                    matrix[i][j] = 0;
                }
            }

            const markets = await this.api.getMarkets();

            for (const m of markets) {
                const baseIndex = currencies.findIndex(c => c === m.base);
                const quoteIndex = currencies.findIndex(c => c === m.quote);
                if (baseIndex !== -1 && quoteIndex !== -1) {
                    matrix[baseIndex][quoteIndex] = 1;
                    matrix[quoteIndex][baseIndex] = 1;
                }
            }

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
};