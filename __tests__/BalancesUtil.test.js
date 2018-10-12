const Balance = require('node-tidex-api/models/Balance');
const Ticker = require('node-tidex-api/models/Ticker');

const fillBalancesWithMainAmount = require('../src/BalancesUtil');

describe('fillMainAmountInBalances', () => {
    const REMBalance = new Balance({ currency: 'REM', free: 0, used: 0, total: 10 });
    const ETHBalance = new Balance({ currency: 'ETH', free: 0, used: 0, total: 10 });
    const USDTBalance = new Balance({ currency: 'USDT', free: 0, used: 0, total: 10 });
    const BTCBalance = new Balance({ currency: 'BTC', free: 0, used: 0, total: 10 });
    const AOIBalance = new Balance({ currency: 'AOI', free: 0, used: 0, total: 10 });

    const REMBTC = new Ticker({ base: 'REM', quote: 'BTC', ask: 5, bid: 7 });
    const BTCUSDT = new Ticker({ base: 'BTC', quote: 'USDT', ask: 5, bid: 7 });
    const ETHUSDT = new Ticker({ base: 'ETH', quote: 'USDT', ask: 5, bid: 7 });
    const BTCETH = new Ticker({ base: 'BTC', quote: 'ETH', ask: 5, bid: 7 });
    const BTCAOI = new Ticker({ base: 'BTC', quote: 'AOI', ask: 5, bid: 7 });

    it('should fill one balance (2 steps, all bids)', () => {
        const balances = [REMBalance];
        const tickers = [ REMBTC, BTCUSDT ];

        const result = fillBalancesWithMainAmount(balances, tickers, 'USDT');

        const mainAmount = REMBalance.total * REMBTC.bid * BTCUSDT.bid;
        const expected = [{
            ...REMBalance,
            mainAmount
        }];

        expect(result).toEqual(expected);
    });

    it('should fill one balance (2 steps, bid and ask)', () => {
        const balances = [ETHBalance];
        const tickers = [ BTCETH, BTCUSDT ];

        const result = fillBalancesWithMainAmount(balances, tickers, 'USDT');

        const mainAmount = (ETHBalance.total / BTCETH.ask) * BTCUSDT.bid;
        const expected = [{
            ...ETHBalance,
            mainAmount
        }];

        expect(result).toEqual(expected);
    });

    it('should fill one balance (same as main currency)', () => {
        const balances = [USDTBalance];
        const tickers = [ BTCETH, BTCUSDT ];

        const result = fillBalancesWithMainAmount(balances, tickers, 'USDT');

        const expected = [{
            ...USDTBalance,
            mainAmount: USDTBalance.total
        }];

        expect(result).toEqual(expected);
    });

    it('should fill one balance (1 step, bid)', () => {
        const balances = [BTCBalance];
        const tickers = [ REMBTC, BTCUSDT ];

        const result = fillBalancesWithMainAmount(balances, tickers, 'USDT');

        const mainAmount = BTCBalance.total * BTCUSDT.bid;
        const expected = [{
            ...BTCBalance,
            mainAmount
        }];

        expect(result).toEqual(expected);
    });

    it('should fill two balances', () => {
        const balances = [ REMBalance, AOIBalance ];
        const tickers = [ REMBTC, BTCAOI, ETHUSDT, BTCETH ];

        const result = fillBalancesWithMainAmount(balances, tickers, 'USDT');

        let mainAmount = REMBalance.total * REMBTC.bid * BTCETH.bid * ETHUSDT.bid;
        const expected = [{
            ...REMBalance,
            mainAmount
        }];

        mainAmount = (AOIBalance.total / BTCAOI.ask) * BTCETH.bid * ETHUSDT.bid;
        expected.push({
            ...AOIBalance,
            mainAmount
        });


        expect(result).toEqual(expected);
    });
});