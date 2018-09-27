module.exports = class Trade {
    constructor({ operation, amount, price, timestamp }) {
        this.operation = operation;
        this.amount = amount;
        this.price = price;
        this.timestamp = timestamp;
    }
};