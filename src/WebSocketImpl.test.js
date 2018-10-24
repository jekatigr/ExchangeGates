const TidexApi = require('node-tidex-api');
const Ticker = require('node-tidex-api/models/Ticker');
const Big = require('big.js');

const WebSocketImpl = require('./WebSocketImpl');

const { GET_BALANCES } = require('./constants/Actions');

jest.mock('../src/ConfigLoader');

const ETHBTC = new Ticker({ base: 'ETH', quote: 'BTC', ask: 0.02, bid: 0.01, last: 0.01, high: 0.02, low: 0.01, avg: 0.015, baseVolume: 100, quoteVolume: 100 });
const BTCUSDT = new Ticker({ base: 'BTC', quote: 'USDT', ask: 0.02, bid: 0.01, last: 0.01, high: 0.02, low: 0.01, avg: 0.015, baseVolume: 100, quoteVolume: 100 });

describe('WebSocket', () => {
    it('should create WS instance', () => {
        const wss = new WebSocketImpl();
        expect(wss).toBeInstanceOf(WebSocketImpl);
    });

    it('should send balances', async () => {
        const balance = { currency: 'ETH', free: 0.1, used: 0.05, total: 0.15 };
        TidexApi.setAccountInfo({ balances: [balance] });

        TidexApi.setTickers([ ETHBTC, BTCUSDT ]);

        const wss = new WebSocketImpl();

        WebSocketImpl.sendMessage = jest.fn();
        WebSocketImpl.sendError = jest.fn();

        const spy = jest.spyOn(WebSocketImpl, 'sendMessage');

        await wss.processAction(undefined, GET_BALANCES, undefined);

        const balances = spy.mock.calls[0][3];
        const mainAmount = +Big(balance.total).times(ETHBTC.bid).times(BTCUSDT.bid);
        expect(balances).toEqual([
            { ...balance, mainAmount }
        ]);
    });
});