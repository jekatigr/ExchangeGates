const WebSocket = require('ws');
const TidexApiService = require('./TidexApiService');
const { timeout } = require('./utils');
const { CONNECTED, AVAILABLE_ACTIONS, ACTION, ORDERBOOKS } = require('./Events');
const {
    GET_ORDERBOOKS,
    RUN_ORDERBOOKS_NOTIFIER,
    STOP_ORDERBOOKS_NOTIFIER,
    GET_BALANCES,
    GET_MARKETS,
    GET_TRIANGLES,
    GET_PRICES
} = require('./Actions');

const { WS_PORT = 2345, TEST } = process.env;

module.exports = class WebSocketImpl {
    static sendMessage(ws, timestampStart, timestampEnd, data, event, action) {
        const body = {
            success: true,
            timestampStart,
            timestampEnd,
            event,
            action,
            data
        };
        ws.send(JSON.stringify(body));
    }

    static sendError(ws, timestampStart, timestampEnd, error, event, action) {
        const body = {
            success: false,
            timestampStart,
            timestampEnd,
            event,
            action,
            error
        };
        ws.send(JSON.stringify(body));
    }

    constructor() {
        this.notifierRunning = false;

        this.service = new TidexApiService();

        if (!TEST) {
            this.wss = new WebSocket.Server({ port: WS_PORT }, () => {
                console.log(`WS server started on :${WS_PORT}`);
            });

            this.wss.on('connection', this.onClientConnect.bind(this));
        }
    }

    async onClientConnect(ws) {
        this.notifierRunning = false;

        ws.on('message', this.onClientMessage.bind(this, ws));

        WebSocketImpl.sendMessage(ws, +new Date(), +new Date(), undefined, CONNECTED);
        WebSocketImpl.sendMessage(ws, +new Date(), +new Date(), Object.values({
            GET_ORDERBOOKS,
            RUN_ORDERBOOKS_NOTIFIER,
            STOP_ORDERBOOKS_NOTIFIER,
            GET_BALANCES,
            GET_MARKETS,
            GET_TRIANGLES,
            GET_PRICES
        }), AVAILABLE_ACTIONS);
    }

    async onClientMessage(ws, message) {
        const start = +new Date();
        try {
            const parsed = JSON.parse(message);

            if (!parsed.action) {
                WebSocketImpl.sendError(ws, start, +new Date(), 'Request should include "action" field.', ACTION);
                return;
            }

            await this.processAction(ws, parsed.action, parsed.params);
        } catch (ex) {
            console.error(`Exception while parse client's message, received: ${message}`);
            WebSocketImpl.sendError(ws, start, +new Date(), 'Incorrect message format.', ACTION);
        }
    }

    async processAction(ws, action, params) {
        let result;
        const start = +new Date();
        try {
            switch (action) {
                case GET_MARKETS: {
                    result = await this.service.getMarkets();
                    break;
                }
                case GET_BALANCES: {
                    result = await this.service.getBalances(params);
                    break;
                }
                case GET_TRIANGLES: {
                    result = await this.service.getTriangles();
                    break;
                }
                case RUN_ORDERBOOKS_NOTIFIER: {
                    if (!this.notifierRunning) {
                        this.notifierRunning = true;
                        this.runOrderBookNotifier(ws, params);
                    }
                    break;
                }
                case STOP_ORDERBOOKS_NOTIFIER: {
                    this.notifierRunning = false;
                    break;
                }
                case GET_ORDERBOOKS: {
                    result = await this.service.getOrderBooks(params);
                    break;
                }
                case GET_PRICES: {
                    result = await this.service.getPrices(params);
                    break;
                }
                default: {
                    WebSocketImpl.sendError(ws, start, +new Date(), 'Such action isn\'t supported.', ACTION, action);
                    return;
                }
            }
        } catch (ex) {
            WebSocketImpl.sendError(ws, start, +new Date(), ex.message, ACTION, action);
            return;
        }

        if (result) {
            WebSocketImpl.sendMessage(ws, start, +new Date(), result, ACTION, action);
        }
    }

    async runOrderBookNotifier(ws, { symbols = [], limit = 1 } = {}) {
        let firstFetch = true;
        /* eslint-disable no-await-in-loop */
        while (this.notifierRunning && ws.readyState === 1) {
            const start = +new Date();
            try {
                const updatedOrderBooks = await this.service.getUpdatedOrderBooks(firstFetch, { symbols, limit });
                firstFetch = false;
                if (
                    this.notifierRunning
                    && updatedOrderBooks
                    && updatedOrderBooks.length > 0
                    && ws.readyState === 1
                ) {
                    WebSocketImpl.sendMessage(ws, start, +new Date(), updatedOrderBooks, ORDERBOOKS);
                }
            } catch (ex) {
                if (ws.readyState === 1) {
                    WebSocketImpl.sendError(ws, start, +new Date(), ex.message, ORDERBOOKS);
                } else {
                    console.log(`Got error when ws was closed, ex: ${ex}`);
                }
            }
            await timeout(100);
        }
        /* eslint-enable no-await-in-loop */
    }
};