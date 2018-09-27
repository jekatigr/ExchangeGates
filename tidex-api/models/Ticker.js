module.exports = class Ticker {
    constructor({ base, quote, ask, bid, last, high, low, avg, baseVolume, quoteVolume }) {
        this.base = base;
        this.quote = quote;
        this.ask = ask;
        this.bid = bid;
        this.last = last;
        this.high = high;
        this.low = low;
        this.avg = avg;
        this.baseVolume = baseVolume;
        this.quoteVolume = quoteVolume;
    }
    // high: maximum price.
    //     low: minimum price.
    //     avg: average price.
    //     vol: trade volume.
    //     vol_cur: trade volume in currency.
    //     last: the price of the last trade.
    //     buy: buy price. - текущая первая строка в стакане на покупку // bid
    //     sell: sell price. - текущая первая строка в стакане на продажу // ask
};