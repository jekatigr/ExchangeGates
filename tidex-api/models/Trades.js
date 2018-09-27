module.exports = class Trades {
    constructor({ base, quote, trades }) {
        this.base = base;
        this.quote = quote;
        this.trades = trades;
    }
};