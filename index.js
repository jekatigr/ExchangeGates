const WebSocketImpl = require('./src/WebSocketImpl');
const { loadConfig } = require('./src/ConfigLoader');

const { API_KEY, API_SECRET } = process.env;
const CONFIG_FILE_PATH = './config.json';

const start = async () => {
    if (!API_KEY || !API_SECRET) {
        console.error('API_KEY and API_SECRET should be specified in env variables. Shutting down...');
        process.exit(1);
    }

    const loadConfigResult = await loadConfig(CONFIG_FILE_PATH);

    if (!loadConfigResult.success) {
        console.error(`System will not start because of config file, error: ${loadConfigResult.error}`);
        process.exit(1);
    } else {
        console.error(`Config file "${CONFIG_FILE_PATH}" was loaded.`);
    }

    WebSocketImpl.start();
};

start();