const WebSocket = require('ws');
const { getConfig } = require('./ConfigLoader');

const { CONNECTED, AVAILABLE_ACTIONS, ACTION, ORDERBOOKS } = require('./constants/Events');
const {
    GET_ORDERBOOKS,
    RUN_ORDERBOOKS_NOTIFIER,
    STOP_ORDERBOOKS_NOTIFIER,
    GET_BALANCES,
    GET_MARKETS,
    GET_TRIANGLES,
    GET_PRICES,
    CREATE_ORDER,
    CANCEL_ORDERS,
    GET_ORDERS,
    GET_ACTIVE_ORDERS
} = require('./constants/Actions');

const { TEST } = process.env;

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

    constructor(exchangeService) {
        this.service = exchangeService;

        const { wsPort = 2345 } = getConfig();
        if (!TEST) {
            this.wss = new WebSocket.Server({ port: wsPort }, () => {
                console.log(`WS server started on :${wsPort}`);
            });

            this.wss.on('connection', this.onClientConnect.bind(this));
        }
    }

    async onClientConnect(ws) {
        ws.on('message', this.onClientMessage.bind(this, ws));
        ws.on('close', () => {
            this.service.stopOrderBookNotifier();
        });

        WebSocketImpl.sendMessage(ws, +new Date(), +new Date(), undefined, CONNECTED);
        WebSocketImpl.sendMessage(ws, +new Date(), +new Date(), Object.values({
            GET_ORDERBOOKS,
            RUN_ORDERBOOKS_NOTIFIER,
            STOP_ORDERBOOKS_NOTIFIER,
            GET_BALANCES,
            GET_MARKETS,
            GET_TRIANGLES,
            GET_PRICES,
            CREATE_ORDER,
            CANCEL_ORDERS,
            GET_ORDERS,
            GET_ACTIVE_ORDERS
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
                    if (!this.service.isNotifierRunning()) {
                        this.service.runOrderBookNotifier(params, (error, result) => {
                            if (error) {
                                const { timestampStart, timestampEnd, data } = error;
                                if (ws.readyState === 1) {
                                    WebSocketImpl.sendError(ws, timestampStart, timestampEnd, data, ORDERBOOKS);
                                } else {
                                    console.log(`Got error when ws was closed, ex: ${data}`);
                                }
                                return;
                            }
                            const { timestampStart, timestampEnd, data } = result;
                            WebSocketImpl.sendMessage(ws, timestampStart, timestampEnd, data, ORDERBOOKS);
                        });
                    }
                    break;
                }
                case STOP_ORDERBOOKS_NOTIFIER: {
                    this.service.stopOrderBookNotifier();
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
                case CREATE_ORDER: {
                    result = await this.service.createOrder(params);
                    break;
                }
                case CANCEL_ORDERS: {
                    result = await this.service.cancelOrders(params);
                    break;
                }
                case GET_ORDERS: {
                    result = await this.service.getOrders(params);
                    break;
                }
                case GET_ACTIVE_ORDERS: {
                    result = await this.service.getActiveOrders(params);
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
};