const WebSocketImpl = require('../src/WebSocketImpl');

const { ACTION } = require('../src/Events');
const { GET_BALANCES } = require('../src/Actions');

jest.mock('../src/ConfigLoader');

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
                currency: 'ETH', free: 0.1, used: 0.05, total: 0.15, mainAmount: 0.000015
            }
        ], ACTION, GET_BALANCES);
    });
});