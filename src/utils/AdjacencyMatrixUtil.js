module.exports = class AdjacencyMatrixUtil {
    static initAdjacencyMatrix(len) {
        const matrix = new Array(len);
        for (let i = 0; i < len; i++) {
            matrix[i] = new Array(len);
            for (let j = 0; j < len; j++) {
                matrix[i][j] = 0;
            }
        }
        return matrix;
    }

    static fillAdjacencyMatrixForCurrencies(tickers, currencies) {
        const matrix = AdjacencyMatrixUtil.initAdjacencyMatrix(currencies.length);

        for (const t of tickers) {
            const baseIndex = currencies.findIndex(c => c === t.base);
            const quoteIndex = currencies.findIndex(c => c === t.quote);
            if (baseIndex !== -1 && quoteIndex !== -1) {
                matrix[baseIndex][quoteIndex] = 1;
                matrix[quoteIndex][baseIndex] = 1;
            }
        }

        return matrix;
    }
};