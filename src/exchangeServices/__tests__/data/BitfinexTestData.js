module.exports = {
    getMarketsTest: {
        case1: {
            source: {
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
            },
            expected: [
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
            ]
        }
    },
    getTrianglesTest: {
        case1: {
            sourceForMarkets: [
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
                },
                {
                    base: 'LTC',
                    quote: 'USDT',
                    precision: {
                        price: 5,
                        amount: 5
                    },
                    taker: 0.002,
                    maker: 0.001,
                    limits: {
                        amount: {
                            min: 0.2,
                            max: 5000
                        },
                        price: {
                            min: 0.00001,
                            max: 100000
                        },
                        cost: {
                            min: 0.0000020000000000000003
                        }
                    }
                },
                {
                    base: 'LTC',
                    quote: 'BTC',
                    precision: {
                        price: 5,
                        amount: 5
                    },
                    taker: 0.002,
                    maker: 0.001,
                    limits: {
                        amount: {
                            min: 0.2,
                            max: 5000
                        },
                        price: {
                            min: 0.00001,
                            max: 100000
                        },
                        cost: {
                            min: 0.0000020000000000000003
                        }
                    }
                },
                {
                    base: 'ETH',
                    quote: 'USDT',
                    precision: {
                        price: 5,
                        amount: 5
                    },
                    taker: 0.002,
                    maker: 0.001,
                    limits: {
                        amount: {
                            min: 0.06,
                            max: 5000
                        },
                        price: {
                            min: 0.00001,
                            max: 100000
                        },
                        cost: {
                            min: 6.000000000000001e-7
                        }
                    }
                },
                {
                    base: 'ETH',
                    quote: 'BTC',
                    precision: {
                        price: 5,
                        amount: 5
                    },
                    taker: 0.002,
                    maker: 0.001,
                    limits: {
                        amount: {
                            min: 0.06,
                            max: 5000
                        },
                        price: {
                            min: 0.00001,
                            max: 100000
                        },
                        cost: {
                            min: 6.000000000000001e-7
                        }
                    }
                }
            ],
            expected: [
                [ 'BTC', 'USDT', 'ETH' ],
                [ 'BTC', 'ETH', 'USDT' ],
                [ 'USDT', 'BTC', 'ETH' ],
                [ 'USDT', 'ETH', 'BTC' ],
                [ 'ETH', 'BTC', 'USDT' ],
                [ 'ETH', 'USDT', 'BTC' ],
                [ 'BTC', 'USDT', 'LTC' ],
                [ 'BTC', 'LTC', 'USDT' ],
                [ 'USDT', 'BTC', 'LTC' ],
                [ 'USDT', 'LTC', 'BTC' ],
                [ 'LTC', 'BTC', 'USDT' ],
                [ 'LTC', 'USDT', 'BTC' ]
            ]
        }
    }
};