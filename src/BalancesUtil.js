const Big = require('big.js');
const { getPrice, getAllCurrenciesFromTickers } = require('./PriceUtil');
const AdjacencyMatrixUtil = require('./AdjacencyMatrixUtil');

class BalancesUtil {
    static fillBalancesWithMainAmount(balances, tickers, targetCurrency) {
        const allCurrencies = getAllCurrenciesFromTickers(tickers);
        const matrix = AdjacencyMatrixUtil.fillAdjacencyMatrixForCurrencies(tickers, allCurrencies);

        for (const balance of balances) {
            const price = getPrice(targetCurrency, allCurrencies, matrix, tickers, balance.currency);
            if (price) {
                balance.mainAmount = +Big(balance.total).times(price.bid);
            }
        }
        return balances;
    }
}

module.exports = BalancesUtil.fillBalancesWithMainAmount;