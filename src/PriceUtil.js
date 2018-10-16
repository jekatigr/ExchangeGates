const Big = require('big.js');
const AdjacencyMatrixUtil = require('./AdjacencyMatrixUtil');
const { bfs } = require('./utils');

/**
 *
 * @param currency Начальная валюта в балансе, которую нужно пересчитать в главную валюту.
 * @param tickers
 * @param pairs
 * @returns {undefined}
 */
const calcPriceByPath = (tickers, pairs, currency) => {
    const tickersFiltered = tickers.filter((t) => {
        const { base, quote } = t;
        return pairs.some(([ f, s ]) => (f === base && s === quote) || (f === quote && s === base));
    });

    let currentPriceAsk = Big(0);
    let currentPriceBid = Big(0);
    let currentCurrency = currency;
    for (const pair of pairs) {
        const [ first, second ] = pair;
        const [ticker] = tickersFiltered.filter(t => (
            (t.base === first && t.quote === second) || (t.base === second && t.quote === first)
        ));

        if (ticker.base === currentCurrency) {
            if (!currentPriceBid.eq(0)) {
                currentPriceBid = currentPriceBid.times(ticker.bid);
            } else {
                currentPriceBid = Big(ticker.bid);
            }

            if (!currentPriceAsk.eq(0)) {
                currentPriceAsk = currentPriceAsk.times(ticker.ask);
            } else {
                currentPriceAsk = Big(ticker.ask);
            }

            currentCurrency = ticker.quote;
        } else if (ticker.quote === currentCurrency) {
            if (!currentPriceBid.eq(0)) {
                currentPriceBid = currentPriceBid.div(ticker.ask);
            } else {
                currentPriceBid = Big(1).div(ticker.ask);
            }

            if (!currentPriceAsk.eq(0)) {
                currentPriceAsk = currentPriceAsk.div(ticker.bid);
            } else {
                currentPriceAsk = Big(1).div(ticker.bid);
            }

            currentCurrency = ticker.base;
        }
    }

    return {
        ask: +currentPriceAsk,
        bid: +currentPriceBid
    };
};

module.exports = class PriceUtil {
    static getAllCurrenciesFromTickers(tickers) {
        const allCurrencies = tickers.reduce((accumulated, current) => {
            const { base, quote, ask, bid } = current;
            if (ask && ask > 0 && bid && bid > 0) {
                accumulated.push(base);
                accumulated.push(quote);
            }
            return accumulated;
        }, []);

        return [...new Set(allCurrencies)]; // удаляем дупликаты
    }

    static getPrices(tickers, currencies = [], mainCurrency) {
        const allCurrencies = PriceUtil.getAllCurrenciesFromTickers(tickers);
        const matrix = AdjacencyMatrixUtil.fillAdjacencyMatrixForCurrencies(tickers, allCurrencies);

        let currenciesArr = currencies;
        if (currenciesArr.length === 0) {
            currenciesArr = allCurrencies;
        }

        const res = [];
        for (const currency of currenciesArr) {
            const price = PriceUtil.getPrice(mainCurrency, allCurrencies, matrix, tickers, currency);

            if (price) {
                res.push({
                    base: currency,
                    quote: mainCurrency,
                    ask: price.ask,
                    bid: price.bid
                });
            }
        }
        return res;
    }

    /**
     * Возвращает цену в формате { ask: number, bid: number }
     * @param targetCurrency
     * @param currencies
     * @param matrix
     * @param tickers
     * @param currency
     * @returns {*}
     */
    static getPrice(targetCurrency, currencies, matrix, tickers, currency) {
        if (currency === targetCurrency) {
            return {
                ask: 1,
                bid: 1
            };
        }

        const startIndex = currencies.findIndex(c => c === currency);
        const targetIndex = currencies.findIndex(c => c === targetCurrency);

        if (startIndex !== -1 && targetIndex !== -1) {
            const path = bfs(matrix, startIndex, targetIndex);

            const pairs = path.map(i => currencies[i]).reduce((accumulated, current, index, array) => {
                if (index !== array.length - 1) {
                    const first = array[index];
                    const second = array[index + 1];
                    accumulated.push([ first, second ]);
                }
                return accumulated;
            }, []);

            return calcPriceByPath(tickers, pairs, currency);
        }
        return undefined;
    }
};