const WebSocket = require('ws');
const TidexApiService = require('./TidexApiService');

const { WS_PORT = 2345 } = process.env;

const COMMANDS = [
    'getBalances',
    'getMarkets'
];

let wss;

const start = () => {
    wss = new WebSocket.Server({ port: WS_PORT }, () => {
        console.log(`WS server started on :${WS_PORT}`);
    });

    wss.on('connection',  onClientConnect);
};

const onClientConnect = (ws) => {
    ws.on('message', onClientMessage.bind(this, ws));
    ws.send(JSON.stringify({ event: "connected", timestamp: +(new Date()) }));
};

const onClientMessage = async (ws, message) => {
    try {
        let parsed = JSON.parse(message);

        if (!parsed.command) {
            sendError(ws, 'Request should include "command" field.');
            return;
        }

        if (!COMMANDS.includes(parsed.command)) {
            sendError(ws, 'Such command isn\'t supported.');
            return;
        }

        await processCommand(ws, parsed.command);
    } catch (ex) {
        console.error(`Exception while parse client's message, received: ${message}`);
        sendError(ws, 'Incorrect message format.');
    }
};

const sendError = (ws, error) => {
    ws.send(JSON.stringify({ success: false, error }));
};

const sendMessage = (ws, message) => {
    ws.send(JSON.stringify({ success: true, result: message }));
};

const processCommand = async (ws, command) => {
    let result;
    switch (command) {
        case 'getMarkets': {
            result = await TidexApiService.getMarkets();
            break;
        }
        case 'getBalances': {
            result = await TidexApiService.getBalances();
            break;
        }
    }

    if (result) {
        sendMessage(ws, result);
    }
};

module.exports = {
    start
};


