const WebSocket = require('ws');
const TidexApiService = require('./TidexApiService');
const { timeout } = require('./utils');

const { WS_PORT = 2345 } = process.env;

const ACTIONS = [
    'runOrderbooksNotifier',
    'stopOrderbooksNotifier',
    'getBalances',
    'getMarkets',
    'getTriangles'
];

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
    };

    static sendError(ws, error, event, action) {
        const body = {
            success: false,
            timestamp: +(new Date()),
            event,
            action,
            error
        };
        ws.send(JSON.stringify(body));
    };

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
        WebSocketImpl.sendMessage(ws, ACTIONS, 'availableActions');
    };

    async onClientMessage(ws, message) {
        try {
            let parsed = JSON.parse(message);

            if (!parsed.action) {
                WebSocketImpl.sendError(ws, 'Request should include "action" field.', 'action');
                return;
            }

            if (!ACTIONS.includes(parsed.action)) {
                WebSocketImpl.sendError(ws, 'Such action isn\'t supported.', 'action', parsed.action);
                return;
            }

            await this.processAction(ws, parsed.action);
        } catch (ex) {
            console.error(`Exception while parse client's message, received: ${message}`);
            WebSocketImpl.sendError(ws, 'Incorrect message format.', 'action');
        }
    };

    async processAction(ws, action) {
        let result;
        try {
            switch (action) {
                case 'getMarkets': {
                    result = await this.service.getMarkets();
                    break;
                }
                case 'getBalances': {
                    result = await this.service.getBalances();
                    break;
                }
                case 'getTriangles': {
                    result = await this.service.getTriangles();
                    break;
                }
                case 'runOrderbooksNotifier': {
                    if (!this.notifierRunning) {
                        this.notifierRunning = true;
                        this.runOrderBookNotifier(ws);
                    }
                    break;
                }
                case 'stopOrderbooksNotifier': {
                    this.notifierRunning = false;
                    break;
                }
            }
        } catch (ex) {
            WebSocketImpl.sendError(ws, ex, 'action', action);
            return;
        }

        if (result) {
            WebSocketImpl.sendMessage(ws, result, 'action', action);
        }
    };

    async runOrderBookNotifier(ws) {
        let firstFetch = true;
        while (this.notifierRunning && ws.readyState === 1) {
            try {
                const updatedOrderBooks = await this.service.getUpdatedOrderBooks(firstFetch);
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
                    WebSocketImpl.sendError(ws, ex, 'orderbooks');
                } else {
                    console.log(`Got error when ws was closed, ex: ${ex}`);
                }
            }
            await timeout(100);
        }
    };
};


