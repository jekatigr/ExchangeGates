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

let wss;
let notifierRunning = false;

const start = () => {
    wss = new WebSocket.Server({ port: WS_PORT }, () => {
        console.log(`WS server started on :${WS_PORT}`);
    });

    wss.on('connection',  onClientConnect);
};

const onClientConnect = (ws) => {
    notifierRunning = false;

    ws.on('message', onClientMessage.bind(this, ws));

    sendMessage(ws, undefined, 'connected');
};

const onClientMessage = async (ws, message) => {
    try {
        let parsed = JSON.parse(message);

        if (!parsed.action) {
            sendError(ws, 'Request should include "action" field.', 'action');
            return;
        }

        if (!ACTIONS.includes(parsed.action)) {
            sendError(ws, 'Such action isn\'t supported.', 'action', parsed.action);
            return;
        }

        await processAction(ws, parsed.action);
    } catch (ex) {
        console.error(`Exception while parse client's message, received: ${message}`);
        sendError(ws, 'Incorrect message format.', 'action');
    }
};

const sendError = (ws, error, event, action) => {
    const body = {
        success: false,
        timestamp: +(new Date()),
        event,
        action,
        error
    };
    ws.send(JSON.stringify(body));
};

const sendMessage = (ws, data, event, action) => {
    const body = {
        success: true,
        timestamp: +(new Date()),
        event,
        action,
        data
    };
    ws.send(JSON.stringify(body));
};

const processAction = async (ws, action) => {
    let result;
    try {
        switch (action) {
            case 'getMarkets': {
                result = await TidexApiService.getMarkets();
                break;
            }
            case 'getBalances': {
                result = await TidexApiService.getBalances();
                break;
            }
            case 'getTriangles': {
                result = await TidexApiService.getTriangles();
                break;
            }
            case 'runOrderbooksNotifier': {
                if (!notifierRunning) {
                    notifierRunning = true;
                    runOrderBookNotifier(ws);
                }
                break;
            }
            case 'stopOrderbooksNotifier': {
                notifierRunning = false;
                break;
            }
        }
    } catch (ex) {
        sendError(ws, ex, 'action', action);
        return;
    }

    if (result) {
        sendMessage(ws, result, 'action', action);
    }
};

const runOrderBookNotifier = async (ws) => {
    let firstFetch = true;
    while (notifierRunning && ws.readyState === 1) {
        try {
            const updatedOrderBooks = await TidexApiService.getUpdatedOrderBooks(firstFetch);
            firstFetch = false;
            if (
                notifierRunning
                && updatedOrderBooks
                && updatedOrderBooks.length > 0
                && ws.readyState === 1
            ) {
                sendMessage(ws, updatedOrderBooks, 'orderbooks');
            }
        } catch (ex) {
            if (ws.readyState === 1) {
                sendError(ws, ex, 'orderbooks');
            } else {
                console.log(`Got error, but ws was closed, ex: ${ex}`);
            }
        }
        await timeout(100);
    }
};

module.exports = {
    start
};


