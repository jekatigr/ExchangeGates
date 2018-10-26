const ccxt = require('ccxt');
const HuobiApiService = require('../HuobiApiService');
const { loadConfig } = require('../../ConfigLoader');

it('should fetch markets', async () => {
    await loadConfig('./config/huobiConfig.json');
    const service = new HuobiApiService();
    ccxt.setMarkets({
        '18C/BTC': {
            limits: {
                amount: {
                    min: 0.01,
                    max: 100
                },
                price: {
                    min: 1e-10
                },
                cost: {
                    min: 0
                }
            },
            precision: {
                amount: 2,
                price: 10
            },
            tierBased: false,
            percentage: true,
            taker: 0.002,
            maker: 0.002,
            id: "18cbtc",
            symbol: "18C/BTC",
            base: "18C",
            quote: "BTC",
            baseId: "18c",
            quoteId: "btc",
            active: true,
            info: {
                "base-currency": "18c",
                "quote-currency": "btc",
                "price-precision": 10,
                "amount-precision": 2,
                "symbol-partition": "innovation",
                "symbol": "18cbtc"
            }
        }
    });
    const markets = await service.getMarkets();
    expect(markets).toEqual([{
        base: '18C',
        quote: 'BTC',
        limits: {
            amount: {
                min: 0.01,
                    max: 100
            },
            price: {
                min: 1e-10
            },
            cost: {
                min: 0
            }
        },
        precision: {
            amount: 2,
                price: 10
        },
        taker: 0.002,
        maker: 0.002
    }])
});