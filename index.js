const WebSocketImpl = require('./src/WebSocketImpl');
const TidexApiService = require('./src/TidexApiService');
const { loadConfig } = require('./src/ConfigLoader');

const { CONFIG_FILE_PATH } = process.env;

const start = async () => {
    if (!CONFIG_FILE_PATH) {
        console.error(`System will not start because of config file option (CONFIG_FILE_PATH environment variable) is not defined.`);
        process.exit(1);
    }

    const loadConfigResult = await loadConfig(CONFIG_FILE_PATH);

    if (!loadConfigResult.success) {
        console.error(`System will not start because of config file, error: ${loadConfigResult.error}`);
        process.exit(1);
    } else {
        console.error(`Config file "${CONFIG_FILE_PATH}" was loaded.`);
    }

    const exchangeService = new TidexApiService();
    // eslint-disable-next-line no-new
    new WebSocketImpl(exchangeService);
};

start();