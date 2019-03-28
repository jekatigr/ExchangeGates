const ccxt = require('ccxt');
const BitfinexApiService = require('../BitfinexApiService');
const { loadConfig } = require('../../ConfigLoader');

const testData = require('./data/BitfinexTestData');

describe('bitfinex API', () => {
    describe('getMarkets method', () => {
        const { getMarketsTest } = testData;
        it('should load and return correct markets', async () => {
            const {
                case1: {
                    source,
                    expected
                }
            } = getMarketsTest;

            await loadConfig('./config/bitfinexConfig.json');

            const service = new BitfinexApiService();
            ccxt.setMarkets(source);
            const markets = await service.getMarkets();

            expect(markets).toEqual(expected);
        });
    });

    describe('getPrices method', () => {
        const { getPricesTest } = testData;
        it('should return correct array of prices', async () => {
            const {
                case1: {
                    source,
                    expected
                }
            } = getPricesTest;

            await loadConfig('./config/bitfinexConfig.json');

            const service = new BitfinexApiService();
            ccxt.setTickers(source);
            const prices = await service.getPrices();

            expect(prices).toEqual(expected);
        });
    });

    describe('getBalances method', () => {
        const { getBalanceTest } = testData;
        it('should return correct balances', async () => {
            const {
                case1: {
                    sourceFetchBalance,
                    sourceForPrices,
                    expected
                }
            } = getBalanceTest;

            await loadConfig('./config/bitfinexConfig.json');

            const service = new BitfinexApiService();
            ccxt.setBalance(sourceFetchBalance);
            service.getPrices = jest.fn().mockReturnValue(sourceForPrices);

            const balances = await service.getBalances(['ETC']);
            expect(balances).toEqual(expected);

            service.getPrices.mockRestore();
        });
    });

    describe('createOrder method', () => {
        const { createOrderTest } = testData;
        it('should return correct created order', async () => {
            const {
                case1: {
                    source,
                    expected
                }
            } = createOrderTest;
            await loadConfig('./config/bitfinexConfig.json');

            const server = new BitfinexApiService();
            ccxt.setCreateOrder(source);

            const order = await server.createOrder({
                symbol: 'BTC/USDT',
                operation: 'buy',
                price: 0.00001,
                amount: 0.002
            });
            expect(order).toEqual(expected);
        });
    });

    describe('cancelOrder method', () => {
        const { cancelOrderTest } = testData;
        it('should return correct cancel order', async () => {
            const {
                case1: {
                    source,
                    expected
                }
            } = cancelOrderTest;
            await loadConfig('./config/bitfinexConfig.json');

            const server = new BitfinexApiService();
            ccxt.setCancelOrder(source);

            const res = await server.cancelOrder({ id: 18613034229 });
            expect(res).toEqual(expected);
        });
    });

    describe('getActiveOrders method', () => {
        const { getActiveOrdersTest } = testData;
        it('should return correct array of active orders', async () => {
            const {
                case1: {
                    source,
                    expected
                }
            } = getActiveOrdersTest;

            await loadConfig('./config/bitfinexConfig.json');

            const server = new BitfinexApiService();
            ccxt.setOpenOrders(source);

            let orders = await server.getActiveOrders();

            orders = orders.map((o) => {
                const { created, ...order } = o;
                return order;
            });
            expect(orders).toEqual(expected);
        });
    });
});