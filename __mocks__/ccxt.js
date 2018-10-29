/* eslint-disable class-methods-use-this */
let markets;
let tickers;

class CCXTApiMock {
    static setMarkets(m) {
        markets = m;
    }
    static setTickers(t) {
        tickers = t;
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
};

module.exports = CCXTApiMock;