module.exports = class Market {
    constructor({ base, quote, precision, fee, minPrice, minAmount, maxPrice, maxAmount, minTotal }) {
        this.base = base;
        this.quote = quote;
        this.precision = precision;
        this.fee = fee;
        this.minPrice = minPrice;
        this.minAmount = minAmount;
        this.maxPrice = maxPrice;
        this.maxAmount = maxAmount;
        this.minTotal = minTotal;
    }
};