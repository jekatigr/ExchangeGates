/* eslint-disable no-unused-vars */

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

    constructor({ exchange, ipArray }, orderbooksUpdatedCallback) {
        this.exchange = exchange;
        this.ipArray = ipArray;
        this.orderbooksUpdatedCallback = orderbooksUpdatedCallback;

        this.currentIpIndex = -1;

        this.notifierRunning = false;
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


    getBalances(currencies = []) {
        throw new Error(`Method getBalances not implemented for exchange '${this.exchange}'`);
    }

    createOrder({ symbol, operation, price, amount, cancelAfter } = {}) {
        throw new Error(`Method createOrder not implemented for exchange '${this.exchange}'`);
    }

    cancelOrder({ symbol, id }) {
        throw new Error(`Method cancelOrder not implemented for exchange '${this.exchange}'`);
    }

    getActiveOrders(symbol) {
        throw new Error(`Method getActiveOrders not implemented for exchange '${this.exchange}'`);
    }

    getOrder({ symbol, id }) {
        throw new Error(`Method getOrder not implemented for exchange '${this.exchange}'`);
    }

    getDepositAddress(currency) {
        throw new Error(`Method getDepositAddress not implemented for exchange '${this.exchange}'`);
    }

    withdraw({ currency, address, amount }) {
        throw new Error(`Method withdraw not implemented for exchange '${this.exchange}'`);
    }
};