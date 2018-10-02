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
    return await api.getMarkets();
};

const getBalances = async () => {
    const { balances } = await api.getAccountInfoExtended();
    return balances;
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

        const pairs = [];
        actualSymbols = [];
        for (const c1 of currencies) {
            for (const c2 of currencies) {
                if (c1 !== c2
                    && !pairs.some(e => (e[0] === c1 && e[1] === c2 || e[1] === c1 && e[0] === c2))
                    && markets.some(m => (m.base === c1 && m.quote === c2 || m.base === c2 && m.quote === c1))
                ) {
                    pairs.push([c1, c2]);
                    let [market] = markets.filter(m => (m.base === c1 && m.quote === c2 || m.base === c2 && m.quote === c1));
                    actualSymbols.push(`${market.base}/${market.quote}`);
                }
            }
        }
    }
    return actualSymbols;
};

const getOrderBooks = async () => {
    let symbols = await getActualSymbols();
    const orderBooks = await api.getOrderBooks({ limit: 1, symbols });
    return orderBooks;
};

const getUpdatedOrderBooks = async () => {
    let allOrderBooks = await getOrderBooks();
    let result;
    if (orderBooksCache) {
        result = filterChangedOrderBooks(allOrderBooks);
    } else {
        result = allOrderBooks;
    }

    orderBooksCache = allOrderBooks;

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

module.exports = {
    getMarkets,
    getBalances,
    getUpdatedOrderBooks
};