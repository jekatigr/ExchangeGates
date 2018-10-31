/* eslint-disable class-methods-use-this */
let markets;
let tickers;
let balance;

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

module.exports = CCXTApiMock;