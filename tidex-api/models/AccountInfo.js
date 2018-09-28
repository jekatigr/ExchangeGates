module.exports = class AccountInfo {
    constructor({ balances, openOrdersCount, rights }) {
        this.balances = balances;
        this.openOrdersCount = openOrdersCount;
        this.rights = rights;
    }
};