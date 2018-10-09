const WebSocketImpl = require('./src/WebSocketImpl');
const { loadConfig } = require('./src/ConfigLoader');

const CONFIG_FILE_PATH = './config.json';

const start = async () => {
    const loadConfigResult = await loadConfig(CONFIG_FILE_PATH);

    if (!loadConfigResult.success) {
        console.error(`System will not start because of config file, error: ${loadConfigResult.error}`);
        process.exit(1);
    } else {
        console.error(`Config file "${CONFIG_FILE_PATH}" was loaded.`);
    }

    // eslint-disable-next-line no-new
    new WebSocketImpl();
};

start();