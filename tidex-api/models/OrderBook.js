module.exports = class OrderBook {
    constructor({ asks, bids }) {
        this.asks = asks;
        this.bids = bids;
    }
};