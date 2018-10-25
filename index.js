const WebSocketImpl = require('./src/WebSocketImpl');
const ExchangeServiceAbstract = require('./src/exchangeServices/ExchangeServiceAbstract');
const TidexApiService = require('./src/exchangeServices/TidexApiService');
const BitfinexApiService = require('./src/exchangeServices/BitfinexApiService');
const HuobiApiService = require('./src/exchangeServices/HuobiApiService');
const { TIDEX, HUOBI, BITFINEX } = require('./src/constants/Exchanges');
const { loadConfig, getConfig } = require('./src/ConfigLoader');

const { CONFIG_FILE_PATH } = process.env;

const start = async () => {
    if (!CONFIG_FILE_PATH) {
        console.error('System will not start because of config file option (CONFIG_FILE_PATH environment variable) is not defined.');
        process.exit(1);
    }

    const loadConfigResult = await loadConfig(CONFIG_FILE_PATH);

    if (!loadConfigResult.success) {
        console.error(`System will not start because of config file, error: ${loadConfigResult.error}`);
        process.exit(1);
    } else {
        console.error(`Config file "${CONFIG_FILE_PATH}" was loaded.`);
    }

    const { exchange } = getConfig();
    let exchangeService;// = new TidexApiService();
    switch (exchange) {
        case TIDEX: { exchangeService = new TidexApiService(); break; }
        case HUOBI: { exchangeService = new HuobiApiService(); break; }
        case BITFINEX: { exchangeService = new BitfinexApiService(); break; }
        default: { exchangeService = new ExchangeServiceAbstract(); break; }
    }
    // eslint-disable-next-line no-new
    new WebSocketImpl(exchangeService);
};

start();