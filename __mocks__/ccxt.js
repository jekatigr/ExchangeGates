/* eslint-disable class-methods-use-this */
let markets;
let tickers;
let balance;
let openOrders;
let cancelOrder;
let newOrder;

class CCXTApiMock {
    static setMarkets(m) {
        markets = m;
    }

    static setTickers(t) {
        tickers = t;
    }

    static setBalance(b) {
        balance = b;
    }

    static setOpenOrders(oo) {
        openOrders = oo;
    }

    static setCancelOrder(co) {
        cancelOrder = co;
    }

    static setCreateOrder(co) {
        newOrder = co;
    }
}

CCXTApiMock.huobipro = class {
    loadMarkets() {
        return markets;
    }
};

CCXTApiMock.bitfinex2 = class {
    loadMarkets() {
        return markets;
    }

    fetchTickers() {
        return tickers;
    }

    fetchBalance() {
        return balance;
    }
};

CCXTApiMock.bitfinex = class {
    fetchOpenOrders() {
        return openOrders;
    }

    cancelOrder() {
        return cancelOrder;
    }

    createOrder() {
        return newOrder;
    }
};

module.exports = CCXTApiMock;