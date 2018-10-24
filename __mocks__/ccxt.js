/* eslint-disable class-methods-use-this */
let markets;

class CCXTApiMock {
    static setMarkets(m) {
        markets = m;
    }
};

CCXTApiMock.huobipro = class {
    loadMarkets() {
        return markets;
    }
};

module.exports = CCXTApiMock;