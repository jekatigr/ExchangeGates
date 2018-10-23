const Big = require('big.js');

const Balance = require('node-tidex-api/models/Balance');
const Ticker = require('node-tidex-api/models/Ticker');

const fillBalancesWithMainAmount = require('../src/utils/BalancesUtil');

describe('fillMainAmountInBalances', () => {
    const REMBalance = new Balance({ currency: 'REM', free: 0, used: 0, total: 10.001 });
    const ETHBalance = new Balance({ currency: 'ETH', free: 0, used: 0, total: 10.001 });
    const USDTBalance = new Balance({ currency: 'USDT', free: 0, used: 0, total: 10.001 });
    const BTCBalance = new Balance({ currency: 'BTC', free: 0, used: 0, total: 10.001 });
    const AOIBalance = new Balance({ currency: 'AOI', free: 0, used: 0, total: 10.001 });

    const REMBTC = new Ticker({ base: 'REM', quote: 'BTC', ask: 5.002, bid: 7.002 });
    const BTCUSDT = new Ticker({ base: 'BTC', quote: 'USDT', ask: 5.002, bid: 7.002 });
    const ETHUSDT = new Ticker({ base: 'ETH', quote: 'USDT', ask: 5.002, bid: 7.002 });
    const BTCETH = new Ticker({ base: 'BTC', quote: 'ETH', ask: 5.002, bid: 7.002 });
    const BTCAOI = new Ticker({ base: 'BTC', quote: 'AOI', ask: 5.002, bid: 7.002 });

    it('should fill one balance (2 steps, all bids)', () => {
        const balances = [REMBalance];
        const tickers = [ REMBTC, BTCUSDT ];

        const result = fillBalancesWithMainAmount(balances, tickers, 'USDT');

        const mainAmount = +Big(REMBalance.total).times(REMBTC.bid).times(BTCUSDT.bid);
        const expected = [{
            ...REMBalance,
            mainAmount
        }];

        expect(result).toEqual(expected);
    });

    it('should fill one balance (2 steps, ask and bid)', () => {
        const balances = [ETHBalance];
        const tickers = [ BTCETH, BTCUSDT ];

        const result = fillBalancesWithMainAmount(balances, tickers, 'USDT');

        const mainAmount = +(Big(ETHBalance.total).div(BTCETH.ask)).times(BTCUSDT.bid);
        const expected = [{
            ...ETHBalance,
            mainAmount
        }];

        expect(result).toEqual(expected);
    });

    it('should fill one balance (2 steps, bid and ask)', () => {
        const balances = [ETHBalance];
        const tickers = [ ETHUSDT, BTCUSDT ];

        const result = fillBalancesWithMainAmount(balances, tickers, 'BTC');

        const mainAmount = +(Big(ETHBalance.total).times(BTCETH.bid)).div(BTCUSDT.ask);
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

        const mainAmount = +Big(BTCBalance.total).times(BTCUSDT.bid);
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

        let mainAmount = +Big(REMBalance.total).times(REMBTC.bid).times(BTCETH.bid).times(ETHUSDT.bid);
        const expected = [{
            ...REMBalance,
            mainAmount
        }];

        mainAmount = +(Big(AOIBalance.total).div(BTCAOI.ask)).times(BTCETH.bid).times(ETHUSDT.bid);
        expected.push({
            ...AOIBalance,
            mainAmount
        });


        expect(result).toEqual(expected);
    });
});