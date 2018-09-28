module.exports = class Order {
    constructor({ id, base, quote, operation, amount, remain = amount, price, created, status }) {
        this.id = id;
        this.base = base;
        this.quote = quote;
        this.operation = operation;
        this.amount = amount;
        this.remain = remain;
        this.price = price;
        this.created = created;
        this.status = status; // 'active', 'closed', 'cancelled', 'cancelled_partially'
    }
};