/* eslint-disable no-unused-vars */

const AdjacencyMatrixUtil = require('../utils/AdjacencyMatrixUtil');

module.exports = class ExchangeServiceAbstract {
    /**
     * Возвращает только обновленные ордербуки.
     * @param allOrderBooks новые ордербуки
     * @param orderBooksCache существующие ордербуки в кэше
     */
    static filterChangedOrderBooks(allOrderBooks, orderBooksCache) {
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
    }

    static calculateTriangles(currencies, markets) {
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
    }

    constructor(exchange, ipArray) {
        this.exchange = exchange;
        this.ipArray = ipArray;
        this.currentIpIndex = -1;

        this.notifierRunning = false;
        this.orderBooksCache = undefined;
    }

    getNextIp() {
        if (this.ipArray && this.ipArray.length > 0) {
            this.currentIpIndex += 1;

            if (this.currentIpIndex >= this.ipArray.length) {
                this.currentIpIndex = 0;
            }
            return this.ipArray[this.currentIpIndex];
        }

        return undefined;
    }

    isNotifierRunning() {
        return this.notifierRunning;
    }

    stopOrderBookNotifier() {
        this.notifierRunning = false;
    }


    getMarkets() {
        throw new Error(`Method getMarkets not implemented for exchange '${this.exchange}'`);
    }

    getOrderBooks({ symbols = [], limit = 1 } = {}) {
        throw new Error(`Method getOrderBooks not implemented for exchange '${this.exchange}'`);
    }

    getUpdatedOrderBooks(all = false, { symbols = [], limit = 1 }) {
        throw new Error(`Method getUpdatedOrderBooks not implemented for exchange '${this.exchange}'`);
    }

    runOrderBookNotifier({ symbols = [], limit = 1 } = {}, callback) {
        throw new Error(`Method runOrderBookNotifier not implemented for exchange '${this.exchange}'`);
    }

    getTriangles() {
        throw new Error(`Method getTriangles not implemented for exchange '${this.exchange}'`);
    }

    getPrices(currencies = []) {
        throw new Error(`Method getPrices not implemented for exchange '${this.exchange}'`);
    }

    getBalances(currencies = []) {
        throw new Error(`Method getBalances not implemented for exchange '${this.exchange}'`);
    }

    createOrder({ symbol, operation, price, amount, cancelAfter } = {}) {
        throw new Error(`Method createOrder not implemented for exchange '${this.exchange}'`);
    }

    cancelOrders(ids = []) {
        throw new Error(`Method cancelOrders not implemented for exchange '${this.exchange}'`);
    }

    getActiveOrders(symbol) {
        throw new Error(`Method getActiveOrders not implemented for exchange '${this.exchange}'`);
    }

    getOrders(ids = []) {
        throw new Error(`Method getOrders not implemented for exchange '${this.exchange}'`);
    }
};