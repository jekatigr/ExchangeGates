const WebSocketImpl = require('../src/WebSocketImpl');
jest.mock('../src/ConfigLoader');

const { CONNECTED, AVAILABLE_ACTIONS, ACTION, ORDERBOOKS } = require('../src/Events');
const {
    GET_ORDERBOOKS,
    RUN_ORDERBOOKS_NOTIFIER,
    STOP_ORDERBOOKS_NOTIFIER,
    GET_BALANCES,
    GET_MARKETS,
    GET_TRIANGLES
} = require('../src/Actions');

describe('WebSocket', () => {
    it('should create WS instance', () => {
        const wss = new WebSocketImpl();
        expect(wss).toBeInstanceOf(WebSocketImpl);
    });

    it('should send balances', async () => {
        const wss = new WebSocketImpl();

        WebSocketImpl.sendMessage = jest.fn();
        WebSocketImpl.sendError = jest.fn();

        const spy = jest.spyOn(WebSocketImpl, 'sendMessage');

        await wss.processAction(undefined, GET_BALANCES, undefined);
        expect(spy).toHaveBeenCalledWith(undefined, [
            {
                currency: "ETH", free: 0.1, used: 0.05, total: 0.15, mainAmount: 0.000015
            }
        ], ACTION, GET_BALANCES);
    });
});