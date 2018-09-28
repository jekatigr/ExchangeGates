module.exports = class Balance {
    constructor({ currency, free = 0, used = 0, total = free + used }) {
        this.currency = currency;
        this.free = free;
        this.used = used;
        this.total = total;
    }
};