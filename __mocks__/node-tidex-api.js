/* eslint-disable class-methods-use-this */
let accountInfo, tickers;

module.exports = class TidexApiMock {
    static setAccountInfo(info) {
        accountInfo = info;
    }

    static setTickers(t) {
        tickers = t;
    }

    getAccountInfoExtended() {
        return accountInfo;
    }

    getTickers() {
        return tickers;
    }
};