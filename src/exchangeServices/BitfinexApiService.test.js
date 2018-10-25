const ccxt = require('ccxt');
const BitfinexApiService = require('./BitfinexApiService');
const { loadConfig } = require('../ConfigLoader');

describe('bitfinex API', () => {
    it('should load and return markets', async () => {
        await loadConfig('./bitfinexConfig.json');
        const service = new BitfinexApiService();
        ccxt.setMarkets({
            'BTC/USDT': {
                limits: {
                    amount: {
                        min: 0.002,
                        max: 2000
                    },
                    price: {
                        min: 0.00001,
                        max: 100000
                    },
                    cost: {
                        min: 2e-8
                    }
                },
                precision: {
                    price: 5,
                    amount: 5
                },
                tierBased: true,
                percentage: true,
                taker: 0.002,
                maker: 0.001,
                tiers: {
                    taker: [
                        [
                            0,
                            0.002
                        ],
                        [
                            500000,
                            0.002
                        ],
                        [
                            1000000,
                            0.002
                        ],
                        [
                            2500000,
                            0.002
                        ],
                        [
                            5000000,
                            0.002
                        ],
                        [
                            7500000,
                            0.002
                        ],
                        [
                            10000000,
                            0.0018
                        ],
                        [
                            15000000,
                            0.0016
                        ],
                        [
                            20000000,
                            0.0014000000000000002
                        ],
                        [
                            25000000,
                            0.0012
                        ],
                        [
                            30000000,
                            0.001
                        ]
                    ],
                    maker: [
                        [
                            0,
                            0.001
                        ],
                        [
                            500000,
                            0.0008
                        ],
                        [
                            1000000,
                            0.0006
                        ],
                        [
                            2500000,
                            0.0004
                        ],
                        [
                            5000000,
                            0.0002
                        ],
                        [
                            7500000,
                            0
                        ],
                        [
                            10000000,
                            0
                        ],
                        [
                            15000000,
                            0
                        ],
                        [
                            20000000,
                            0
                        ],
                        [
                            25000000,
                            0
                        ],
                        [
                            30000000,
                            0
                        ]
                    ]
                },
                id: 'BTCUSD',
                symbol: 'BTC/USDT',
                base: 'BTC',
                quote: 'USDT',
                baseId: 'BTC',
                quoteId: 'USD',
                active: true,
                info: {
                    pair: 'btcusd',
                    price_precision: 5,
                    initial_margin: 30.0,
                    minimum_margin: 15.0,
                    maximum_order_size: 2000.0,
                    minimum_order_size: 0.002,
                    expiration: 'NA',
                    margin: true
                }
            }
        });
        const markets = await service.getMarkets();
        expect(markets).toEqual([
            {
                base: 'BTC',
                quote: 'USDT',
                precision: {
                    price: 5,
                    amount: 5
                },
                taker: 0.002,
                maker: 0.001,
                limits: {
                    amount: {
                        min: 0.002,
                        max: 2000
                    },
                    price: {
                        min: 0.00001,
                        max: 100000
                    },
                    cost: {
                        min: 2e-8
                    }
                }
            }
        ]);
    });
});