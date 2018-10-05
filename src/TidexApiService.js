const TidexApi = require('node-tidex-api');
const { getConfig } = require('./ConfigLoader');

const { API_KEY, API_SECRET } = process.env;

const api = new TidexApi({
    apiKey: API_KEY,
    apiSecret: API_SECRET
});

let actualSymbols;
let orderBooksCache;

const getMarkets = async () => {
    try {
        return await api.getMarkets();
    } catch (ex) {
        console.log(`Exception while fetching markets, ex: ${ex}, stacktrace: ${ex.stack}`);
        throw new Error(`Exception while fetching markets, ex: ${ex}`);
    }
};

const getBalances = async () => {
    try {
        const { balances } = await api.getAccountInfoExtended();
        return balances;
    } catch (ex) {
        console.log(`Exception while fetching balances, ex: ${ex}, stacktrace: ${ex.stack}`);
        throw new Error(`Exception while fetching balances, ex: ${ex}`);
    }
};

const getOrderBooks = async () => {
    let symbols = await getActualSymbols();
    return await api.getOrderBooks({ limit: 1, symbols });
};

const getUpdatedOrderBooks = async () => {
    let result = [];
    try {
        let allOrderBooks = await getOrderBooks();
        if (orderBooksCache) {
            result = filterChangedOrderBooks(allOrderBooks);
        } else {
            result = allOrderBooks;
        }
        orderBooksCache = allOrderBooks;
    } catch (ex) {
        console.log(`Exception while fetching updated orderbooks, ex: ${ex}, stacktrace: ${ex.stack}`);
        throw new Error(`Exception while fetching updated orderbooks, ex: ${ex}`);
    }
    return result;
};

/**
 * Возвращает только обновленные ордербуки.
 * @param allOrderBooks
 */
const filterChangedOrderBooks = (allOrderBooks) => {
    let result = [];
    allOrderBooks.forEach(orderBook => {
        const [ cached ] = orderBooksCache.filter(c => c.base === orderBook.base && c.quote === orderBook.quote);
        if (!cached) {
            result.push(orderBook);
        } else {
            const { asks: cachedAsks, bids: cachedBids } = cached;
            const { asks, bids } = orderBook;
            if (asks.length !== cachedAsks.length || bids.length !== cachedBids.length) {
                result.push(orderBook);
            } else { // длина массиво асков и бидов одинакова
                let changed = false;
                for(let i = 0; i < asks.length && !changed; i++) {
                    if (asks[i][0] !== cachedAsks[i][0] || asks[i][1] !== cachedAsks[i][1]) {
                        changed = true;
                    }
                }

                for(let i = 0; i < bids.length && !changed; i++) {
                    if (bids[i][0] !== cachedBids[i][0] || bids[i][1] !== cachedBids[i][1]) {
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

/**
 * Возвращает символы, которые нужно будет отслеживать в треугольниках.
 * @returns {Promise<Array>}
 */
const getActualSymbols = async () => {
    if (!actualSymbols) {
        const config = getConfig();
        const {currencies} = config;
        const markets = await api.getMarkets();

        actualSymbols = [];
        for (const m of markets) {
            const baseIndex = currencies.findIndex(c => c === m.base);
            const quoteIndex = currencies.findIndex(c => c === m.quote);
            if (baseIndex !== -1 && quoteIndex !== -1) {
                actualSymbols.push(`${m.base}/${m.quote}`);
            }
        }

    }
    return actualSymbols;
};

const getTriangles = async () => {
    try {
        const config = getConfig();
        const {currencies} = config;

        //создаем матрицу смежности
        const matrix = new Array(currencies.length);
        for (let i = 0; i < currencies.length; i++) {
            matrix[i] = new Array(currencies.length);
            for (let j = 0; j < currencies.length; j++) {
                matrix[i][j] = 0;
            }
        }

        const markets = await api.getMarkets();

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
                if (matrix[a][b] === 0) continue;
                for (let c = b + 1; c < currencies.length; c++) {
                    if (matrix[b][c] === 1 && matrix[a][c] === 1) {
                        triangles.push([currencies[a], currencies[b], currencies[c]]);
                        triangles.push([currencies[a], currencies[c], currencies[b]]);
                        triangles.push([currencies[b], currencies[a], currencies[c]]);
                        triangles.push([currencies[b], currencies[c], currencies[a]]);
                        triangles.push([currencies[c], currencies[a], currencies[b]]);
                        triangles.push([currencies[c], currencies[b], currencies[a]]);
                    }
                }
            }
        }

        return triangles;
    } catch (ex) {
        console.log(`Exception while fetching triangles, ex: ${ex}, stacktrace: ${ex.stack}`);
        throw new Error(`Exception while fetching triangles, ex: ${ex}`);
    }
};

module.exports = {
    getMarkets,
    getBalances,
    getUpdatedOrderBooks,
    getTriangles
};