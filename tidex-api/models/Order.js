module.exports = class Order {
    constructor({ id, base, quote, operation, amount, price, created }) {
        this.id = id;
        this.base = base;
        this.quote = quote;
        this.operation = operation;
        this.amount = amount;
        this.price = price;
        this.created = created;
    }
};