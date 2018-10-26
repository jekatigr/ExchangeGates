const ccxt = require('ccxt');
const BitfinexApiService = require('../BitfinexApiService');
const { loadConfig } = require('../../ConfigLoader');

const testData = require('./data/BitfinexTestData');

describe('bitfinex API', () => {
    describe('getMarkers method', () => {
        const { getMarkersTest } = testData;
        it('should load and return correct markets', async () => {
            const {
                case1: {
                    source,
                    expected
                }
            } = getMarkersTest;

            await loadConfig('./config/bitfinexConfig.json');

            const service = new BitfinexApiService();
            ccxt.setMarkets(source);
            const markets = await service.getMarkets();

            expect(markets).toEqual(expected);
        });
    });

    describe('getTriangles method', () => {
        const { getTrianglesTest } = testData;
        it('should return correct triangles', async () => {
            const {
                case1: {
                    sourceForMarkets,
                    expected
                }
            } = getTrianglesTest;

            await loadConfig('./config/bitfinexConfig.json');

            const service = new BitfinexApiService();

            service.getMarkets = jest.fn().mockReturnValue(sourceForMarkets);

            const triangles = await service.getTriangles();

            expect(triangles).toEqual(expected);
        });
    });
});