const Ticker = require('node-tidex-api/models/Ticker');

module.exports = class TidexApiMock {
    getAccountInfoExtended() {
        return {
            balances: [{
                currency: "ETH",
                free: 0.1,
                used: 0.05,
                total: 0.15
            }]
        }
    };

    getTickers() {
        return [
            new Ticker({
                "base":"ETH","quote":"BTC","ask":0.02,"bid":0.01,"last":0.01,"high":0.02,"low":0.01,"avg":0.015,"baseVolume":100,"quoteVolume":100
            }),
            new Ticker({
                "base":"BTC","quote":"USDT","ask":0.02,"bid":0.01,"last":0.01,"high":0.02,"low":0.01,"avg":0.015,"baseVolume":100,"quoteVolume":100
            })
        ];
    }
};