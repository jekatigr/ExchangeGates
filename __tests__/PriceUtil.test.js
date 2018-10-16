const Big = require('big.js');

const Ticker = require('node-tidex-api/models/Ticker');

const { getPrices, getAllCurrenciesFromTickers } = require('../src/PriceUtil');

describe('getPrice', () => {
    const REMBTC = new Ticker({ base: 'REM', quote: 'BTC', ask: 5.002, bid: 7.002 });
    const BTCUSDT = new Ticker({ base: 'BTC', quote: 'USDT', ask: 5.002, bid: 7.002 });
    const USDTBTC = new Ticker({ base: 'USDT', quote: 'BTC', ask: 5.002, bid: 7.002 });
    const ETHUSDT = new Ticker({ base: 'ETH', quote: 'USDT', ask: 5.002, bid: 7.002 });
    const BTCETH = new Ticker({ base: 'BTC', quote: 'ETH', ask: 5.002, bid: 7.002 });

    it('should return all currencies from tickers', () => {
        const tickers = [ REMBTC, BTCUSDT, ETHUSDT, BTCETH ];

        const result = getAllCurrenciesFromTickers(tickers);

        const expected = [ 'REM', 'BTC', 'USDT', 'ETH' ];

        expect(result).toEqual(expected);
    });

    it('with same currency', () => {
        const from1 = 'USDT';
        const from2 = 'BTC';
        const to = 'USDT';

        const currencies = [ from1, from2 ];
        const tickers = [BTCUSDT];

        const result = getPrices(tickers, currencies, to);

        const expected = [{
            base: from1,
            quote: to,
            ask: 1,
            bid: 1
        }, {
            base: from2,
            quote: to,
            ask: BTCUSDT.ask,
            bid: BTCUSDT.bid
        }];

        expect(result).toEqual(expected);
    });

    it('without transformations', () => {
        const currencies = ['ETH'];
        const tickers = [ETHUSDT];

        const result = getPrices(tickers, currencies, 'USDT');

        const expected = [{
            base: 'ETH',
            quote: 'USDT',
            ask: ETHUSDT.ask,
            bid: ETHUSDT.bid
        }];

        expect(result).toEqual(expected);
    });

    it('another direction', () => {
        const currencies = ['USDT'];
        const tickers = [ETHUSDT];

        const result = getPrices(tickers, currencies, 'ETH');

        const bid = +Big(1).div(ETHUSDT.ask);
        const ask = +Big(1).div(ETHUSDT.bid);
        const expected = [{
            base: 'USDT',
            quote: 'ETH',
            ask,
            bid
        }];

        expect(result).toEqual(expected);
    });

    it('two transforms 1', () => {
        const from = 'ETH';
        const to = 'USDT';

        const currencies = [from];
        const tickers = [ BTCETH, BTCUSDT ];

        const result = getPrices(tickers, currencies, to);

        const bid = +(Big(1).div(BTCETH.ask)).times(BTCUSDT.bid);
        const ask = +(Big(1).div(BTCETH.bid)).times(BTCUSDT.ask);
        const expected = [{
            base: from,
            quote: to,
            ask,
            bid
        }];

        expect(result).toEqual(expected);
    });

    it('two transforms 2', () => {
        const from = 'ETH';
        const to = 'USDT';

        const currencies = [from];
        const tickers = [ BTCETH, USDTBTC ];

        const result = getPrices(tickers, currencies, to);

        const bid = +(Big(1).div(BTCETH.ask)).times(Big(1).div(USDTBTC.ask));
        const ask = +(Big(1).div(BTCETH.bid)).times(Big(1).div(USDTBTC.bid));
        const expected = [{
            base: from,
            quote: to,
            ask,
            bid
        }];

        expect(result).toEqual(expected);
    });

    it('non existing currency', () => {
        const from = 'ETH';
        const to = 'USDT';

        const currencies = [from];
        const tickers = [BTCUSDT];

        const result = getPrices(tickers, currencies, to);

        const expected = [];

        expect(result).toEqual(expected);
    });

    it('non existing currency with one valid', () => {
        const from1 = 'ETH';
        const from2 = 'BTC';
        const to = 'USDT';

        const currencies = [ from1, from2 ];
        const tickers = [BTCUSDT];

        const result = getPrices(tickers, currencies, to);

        const expected = [{
            base: from2,
            quote: to,
            ask: BTCUSDT.ask,
            bid: BTCUSDT.bid
        }];

        expect(result).toEqual(expected);
    });
});