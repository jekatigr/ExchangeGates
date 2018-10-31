jest.dontMock('ccxt')
const ccxt = require('ccxt');
const HuobiApiService = require('../HuobiApiService');
const { loadConfig } = require('../../ConfigLoader');

const testData = require('./data/HuobiTestData');

describe('huobi API', () => {
    let service;

    beforeAll(async () => {
        await loadConfig('./config/huobiConfig.json');
        service = new HuobiApiService();
    });

    describe('getMarkets method', () => {
        const { getMarketsTest } = testData;
        it('should load and return correct markets', async () => {
            const {
                case1: {
                    source,
                    expected
                }
            } = getMarketsTest;

            ccxt.setMarkets(source);
            const markets = await service.getMarkets();

            expect(markets).toEqual(expected);
        });
    });

    describe('getPrices method', () => {
        // const { getMarketsTest } = testData;
        it('should load and return correct prices', async () => {
            // const {
            //     case1: {
            //         source,
            //         expected
            //     }
            // } = getMarketsTest;


            // ccxt.setMarkets(source);
            // jest.unmock('ccxt');

            const prices = await service.getBalances();

            // expect(markets).toEqual(expected);
        });
    });
});