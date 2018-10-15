const WebSocket = require('ws');
const TidexApiService = require('./TidexApiService');
const { timeout } = require('./utils');

const { WS_PORT = 2345 } = process.env;

const ACTIONS = {
    RUN_ORDERBOOKS_NOTIFIER: 'runOrderbooksNotifier',
    STOP_ORDERBOOKS_NOTIFIER: 'stopOrderbooksNotifier',
    GET_BALANCES: 'getBalances',
    GET_MARKETS: 'getMarkets',
    GET_TRIANGLES: 'getTriangles'
};

module.exports = class WebSocketImpl {
    static sendMessage(ws, data, event, action) {
        const body = {
            success: true,
            timestamp: +(new Date()),
            event,
            action,
            data
        };
        ws.send(JSON.stringify(body));
    }

    static sendError(ws, error, event, action) {
        const body = {
            success: false,
            timestamp: +(new Date()),
            event,
            action,
            error
        };
        ws.send(JSON.stringify(body));
    }

    constructor() {
        this.notifierRunning = false;

        this.service = new TidexApiService();

        this.wss = new WebSocket.Server({ port: WS_PORT }, () => {
            console.log(`WS server started on :${WS_PORT}`);
        });

        this.wss.on('connection', this.onClientConnect.bind(this));
    }

    async onClientConnect(ws) {
        this.notifierRunning = false;

        ws.on('message', this.onClientMessage.bind(this, ws));

        WebSocketImpl.sendMessage(ws, undefined, 'connected');
        WebSocketImpl.sendMessage(ws, Object.values(ACTIONS), 'availableActions');
    }

    async onClientMessage(ws, message) {
        try {
            const parsed = JSON.parse(message);

            if (!parsed.action) {
                WebSocketImpl.sendError(ws, 'Request should include "action" field.', 'action');
                return;
            }

            await this.processAction(ws, parsed.action, parsed.params);
        } catch (ex) {
            console.error(`Exception while parse client's message, received: ${message}`);
            WebSocketImpl.sendError(ws, 'Incorrect message format.', 'action');
        }
    }

    async processAction(ws, action, params) {
        let result;
        try {
            switch (action) {
                case ACTIONS.GET_MARKETS: {
                    result = await this.service.getMarkets();
                    break;
                }
                case ACTIONS.GET_BALANCES: {
                    result = await this.service.getBalances(params);
                    break;
                }
                case ACTIONS.GET_TRIANGLES: {
                    result = await this.service.getTriangles();
                    break;
                }
                case ACTIONS.RUN_ORDERBOOKS_NOTIFIER: {
                    if (!this.notifierRunning) {
                        this.notifierRunning = true;
                        this.runOrderBookNotifier(ws, params);
                    }
                    break;
                }
                case ACTIONS.STOP_ORDERBOOKS_NOTIFIER: {
                    this.notifierRunning = false;
                    break;
                }
                default: {
                    WebSocketImpl.sendError(ws, 'Such action isn\'t supported.', 'action', action);
                    return;
                }
            }
        } catch (ex) {
            WebSocketImpl.sendError(ws, ex.message, 'action', action);
            return;
        }

        if (result) {
            WebSocketImpl.sendMessage(ws, result, 'action', action);
        }
    }

    async runOrderBookNotifier(ws, symbols = []) {
        let firstFetch = true;
        /* eslint-disable no-await-in-loop */
        while (this.notifierRunning && ws.readyState === 1) {
            try {
                const updatedOrderBooks = await this.service.getUpdatedOrderBooks(symbols, firstFetch);
                firstFetch = false;
                if (
                    this.notifierRunning
                    && updatedOrderBooks
                    && updatedOrderBooks.length > 0
                    && ws.readyState === 1
                ) {
                    WebSocketImpl.sendMessage(ws, updatedOrderBooks, 'orderbooks');
                }
            } catch (ex) {
                if (ws.readyState === 1) {
                    WebSocketImpl.sendError(ws, ex.message, 'orderbooks');
                } else {
                    console.log(`Got error when ws was closed, ex: ${ex}`);
                }
            }
            await timeout(100);
        }
        /* eslint-enable no-await-in-loop */
    }
};