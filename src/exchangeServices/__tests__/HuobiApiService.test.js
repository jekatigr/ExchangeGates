const ccxt = require('ccxt');
const HuobiApiService = require('../HuobiApiService');
const { loadConfig } = require('../../ConfigLoader');

const testData = require('./data/HuobiTestData');

describe('huobi API', () => {
    describe('getMarkets method', () => {
        const { getMarketsTest } = testData;
        it('should load and return correct markets', async () => {
            const {
                case1: {
                    source,
                    expected
                }
            } = getMarketsTest;

            await loadConfig('./config/huobiConfig.json');

            const service = new HuobiApiService();
            ccxt.setMarkets(source);
            const markets = await service.getMarkets();

            expect(markets).toEqual(expected);
        });
    });
});