const AdjacencyMatrixUtil = require('./AdjacencyMatrixUtil');
const { bfs } = require('./utils');

class BalancesUtil {
    static fillBalancesWithMainAmount(balances, tickers, mainCurrency) {
        const allCurrencies = BalancesUtil.getAllCurrenciesFromTickers(tickers);
        const matrix = AdjacencyMatrixUtil.fillAdjacencyMatrixForCurrencies(tickers, allCurrencies);

        for (const balance of balances) {
            balance.mainAmount = BalancesUtil.getMainAmount(mainCurrency, allCurrencies, matrix, tickers, balance);
        }
        return balances;
    }

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

    static getMainAmount(mainCurrency, currencies, matrix, tickers, balance) {
        if (balance.currency === mainCurrency) {
            return balance.total;
        }

        const startIndex = currencies.findIndex(c => c === balance.currency);
        const targetIndex = currencies.findIndex(c => c === mainCurrency);
        const path = bfs(matrix, startIndex, targetIndex);

        const pairs = path.map(i => currencies[i]).reduce((accumulated, current, index, array) => {
            if (index !== array.length - 1) {
                const first = array[index];
                const second = array[index + 1];
                accumulated.push([ first, second ]);
            }
            return accumulated;
        }, []);

        return BalancesUtil.calcMainAmount(tickers, pairs, balance.currency, balance.total);
    }

    /**
     *
     * @param currency Начальная валюта в балансе, которую нужно пересчитать в главную валюту.
     * @param tickers
     * @param pairs
     * @returns {undefined}
     */
    static calcMainAmount(tickers, pairs, currency, amount) {
        const tickersFiltered = tickers.filter((t) => {
            const { base, quote } = t;
            return pairs.some(([ f, s ]) => (f === base && s === quote) || (f === quote && s === base));
        });

        let currentAmount = amount;
        let currentCurrency = currency;
        for (const pair of pairs) {
            const [ first, second ] = pair;
            const [ticker] = tickersFiltered.filter(t => (
                (t.base === first && t.quote === second) || (t.base === second && t.quote === first)
            ));

            if (ticker.base === currentCurrency) {
                currentAmount *= ticker.bid;
                currentCurrency = ticker.quote;
            } else if (ticker.quote === currentCurrency) {
                currentAmount /= ticker.ask;
                currentCurrency = ticker.base;
            }
        }

        return currentAmount;
    }
}

module.exports = BalancesUtil.fillBalancesWithMainAmount;