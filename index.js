const WebSocketImpl = require('./src/WebSocketImpl');

const { API_KEY, API_SECRET } = process.env;

if (!API_KEY || !API_SECRET) {
    console.error('API_KEY and API_SECRET should be specified in env variables. Shutting down...');
    process.exit(1);
}

WebSocketImpl.start();