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
    },
    getPricesTest: {
        case1: {
            source: {
                'BTC/USDT':
                    {
                        symbol: 'BTC/USDT',
                        timestamp: 1540825379200,
                        datetime: '2018-10-29T15:02:59.200Z',
                        high: 6512,
                        low: 6320.8,
                        bid: 6364.1,
                        bidVolume: undefined,
                        ask: 6364.2,
                        askVolume: undefined,
                        vwap: undefined,
                        open: undefined,
                        close: 6364.10281183,
                        last: 6364.10281183,
                        previousClose: undefined,
                        change: -135.99718817,
                        percentage: -2.09,
                        average: undefined,
                        baseVolume: 18348.67651798,
                        quoteVolume: undefined,
                        info:
                            [ 'tBTCUSD',
                                6364.1,
                                58.86682578,
                                6364.2,
                                118.22601725,
                                -135.99718817,
                                -0.0209,
                                6364.10281183,
                                18348.67651798,
                                6512,
                                6320.8 ]
                    },
                'LTC/USDT':
                    {
                        symbol: 'LTC/USDT',
                        timestamp: 1540825379200,
                        datetime: '2018-10-29T15:02:59.200Z',
                        high: 52.27,
                        low: 48,
                        bid: 49.512,
                        bidVolume: undefined,
                        ask: 49.513,
                        askVolume: undefined,
                        vwap: undefined,
                        open: undefined,
                        close: 49.512,
                        last: 49.512,
                        previousClose: undefined,
                        change: -2.755,
                        percentage: -5.27,
                        average: undefined,
                        baseVolume: 100250.18964819,
                        quoteVolume: undefined,
                        info:
                            [ 'tLTCUSD',
                                49.512,
                                1464.58635448,
                                49.513,
                                1290.76469022,
                                -2.755,
                                -0.0527,
                                49.512,
                                100250.18964819,
                                52.27,
                                48 ]
                    },
                'LTC/BTC':
                    {
                        symbol: 'LTC/BTC',
                        timestamp: 1540825379200,
                        datetime: '2018-10-29T15:02:59.200Z',
                        high: 0.0080403,
                        low: 0.007612,
                        bid: 0.0077798,
                        bidVolume: undefined,
                        ask: 0.0077897,
                        askVolume: undefined,
                        vwap: undefined,
                        open: undefined,
                        close: 0.007784,
                        last: 0.007784,
                        previousClose: undefined,
                        change: -0.0002495,
                        percentage: -3.11,
                        average: undefined,
                        baseVolume: 24222.64896883,
                        quoteVolume: undefined,
                        info:
                            [ 'tLTCBTC',
                                0.0077798,
                                819.93462978,
                                0.0077897,
                                2589.63497255,
                                -0.0002495,
                                -0.0311,
                                0.007784,
                                24222.64896883,
                                0.0080403,
                                0.007612 ]
                    },
            },
            expected: [
                { base: 'BTC', quote: 'USDT', ask: 6364.2, bid: 6364.1 },
                { base: 'USDT', quote: 'USDT', ask: 1, bid: 1 },
                { base: 'LTC', quote: 'USDT', ask: 49.513, bid: 49.512 }
            ]
        }
    },
    getBalanceTest: {
        case1: {
            sourceFetchBalance: {
                info: [
                    [
                        'funding',
                        'ETH',
                        0.15532976,
                        0,
                        null
                    ],
                    [
                        'exchange',
                        'ETC',
                        70.0173445,
                        0,
                        null
                    ],
                    [
                        'exchange',
                        'NEO',
                        0.0000658,
                        0,
                        null
                    ],
                    [
                        'exchange',
                        'USD',
                        245.69379164,
                        0,
                        null
                    ],
                    [
                        'exchange',
                        'XRP',
                        1e-8,
                        0,
                        null
                    ]
                ],
                ETC: {
                    free: 70.0173445,
                    used: 0,
                    total: 70.0173445
                },
                NEO: {
                    free: 0.0000658,
                    used: 0,
                    total: 0.0000658
                },
                USDT: {
                    free: 245.69379164,
                    used: 0,
                    total: 245.69379164
                },
                XRP: {
                    free: 1e-8,
                    used: 0,
                    total: 1e-8
                },
                free: {
                    ETC: 70.0173445,
                    NEO: 0.0000658,
                    USDT: 245.69379164,
                    XRP: 1e-8
                },
                used: {
                    ETC: 0,
                    NEO: 0,
                    USDT: 0,
                    XRP: 0
                },
                total: {
                    ETC: 70.0173445,
                    NEO: 0.0000658,
                    USDT: 245.69379164,
                    XRP: 1e-8
                }
            },
            sourceForPrices: [
                {
                    base: 'ETC',
                    quote: 'USDT',
                    ask: 9.0119,
                    bid: 9.0118
                },
                {
                    base: 'NEO',
                    quote: 'USDT',
                    ask: 15.266,
                    bid: 15.256
                },
                {
                    base: 'USDT',
                    quote: 'USDT',
                    ask: 1,
                    bid: 1
                },
                {
                    base: 'XRP',
                    quote: 'USDT',
                    ask: 0.44538,
                    bid: 0.44537
                }
            ],
            expected: [
                {
                    currency: 'ETC',
                    total: 70.0173445,
                    used: 0,
                    free: 70.0173445,
                    mainAmount: 630.9823051651
                }
            ]
        }

    },
    createOrderTest: {
        case1: {
            source: {
                info: {
                    id: 18609031664,
                    cid: 36969309440,
                    cid_date: '2018-11-01',
                    gid: null,
                    symbol: 'btcusd',
                    exchange: 'bitfinex',
                    price: 0.00001,
                    avg_execution_price: 0.0,
                    side: 'buy',
                    type: 'exchange limit',
                    timestamp: 1541067369.327826096,
                    is_live: true,
                    is_cancelled: false,
                    is_hidden: false,
                    oco_order: null,
                    was_forced: false,
                    original_amount: 0.002,
                    remaining_amount: 0.002,
                    executed_amount: 0.0,
                    src: 'api',
                    order_id: 18609031664
                },
                id: 18609031664,
                timestamp: 1541067369327,
                datetime: '2018-11-01T10:16:09.327Z',
                symbol: 'BTC/USDT',
                type: 'limit',
                side: 'buy',
                price: 0.00001,
                average: 0,
                amount: 0.002,
                remaining: 0.002,
                filled: 0,
                status: 'open'
            },
            expected: {
                id: 18609031664,
                base: 'BTC',
                quote: 'USDT',
                operation: 'buy',
                amount: 0.002,
                remain: 0.002,
                price: 0.00001,
                created: 1541067369327,
                status: 'active',
                average: 0
            }
        }
    },
    cancelOrderTest: {
        case1: {
            source: {
                id: 18613034229,
                cid: 50276532735,
                cid_date: '2018-11-01',
                gid: null,
                symbol: 'btcusd',
                exchange: 'bitfinex',
                price: 0.00001,
                avg_execution_price: 0.0,
                side: 'buy',
                type: 'exchange limit',
                timestamp: 1541080677.0,
                is_live: true,
                is_cancelled: false,
                is_hidden: false,
                oco_order: null,
                was_forced: false,
                original_amount: 0.002,
                remaining_amount: 0.002,
                executed_amount: 0.0,
                src: 'api'
            },
            expected: [
                {
                    id: 18613034229,
                    success: true
                }
            ]
        }
    },
    getActiveOrdersTest: {
        case1: {
            source: [
                {
                    info: {
                        id: 18613002834,
                        cid: 50174043403,
                        cid_date: '2018-11-01',
                        gid: null,
                        symbol: 'btcusd',
                        exchange: 'bitfinex',
                        price: 0.00001,
                        avg_execution_price: 0.0,
                        side: 'buy',
                        type: 'exchange limit',
                        timestamp: 1541080574.0,
                        is_live: true,
                        is_cancelled: false,
                        is_hidden: false,
                        oco_order: null,
                        was_forced: false,
                        original_amount: 0.002,
                        remaining_amount: 0.002,
                        executed_amount: 0.0,
                        src: 'api'
                    },
                    id: 18613002834,
                    timestamp: 1541080574000,
                    datetime: '2018-11-01T13:56:14.000Z',
                    symbol: 'BTC/USDT',
                    type: 'limit',
                    side: 'buy',
                    price: 0.00001,
                    average: 0,
                    amount: 0.002,
                    remaining: 0.002,
                    filled: 0,
                    status: 'open'
                },
                {
                    info: {
                        id: 18613034229,
                        cid: 50276532735,
                        cid_date: '2018-11-01',
                        gid: null,
                        symbol: 'btcusd',
                        exchange: 'bitfinex',
                        price: 0.00001,
                        avg_execution_price: 0.0,
                        side: 'buy',
                        type: 'exchange limit',
                        timestamp: 1541080677.0,
                        is_live: true,
                        is_cancelled: false,
                        is_hidden: false,
                        oco_order: null,
                        was_forced: false,
                        original_amount: 0.002,
                        remaining_amount: 0.002,
                        executed_amount: 0.0,
                        src: 'api'
                    },
                    id: 18613034229,
                    timestamp: 1541080677000,
                    datetime: '2018-11-01T13:57:57.000Z',
                    symbol: 'BTC/USDT',
                    type: 'limit',
                    side: 'buy',
                    price: 0.00001,
                    average: 0,
                    amount: 0.002,
                    remaining: 0.002,
                    filled: 0,
                    status: 'open'
                }
            ],
            expected: [
                {
                    id: 18613002834,
                    base: 'BTC',
                    quote: 'USDT',
                    operation: 'buy',
                    amount: 0.002,
                    remain: 0.002,
                    price: 0.00001,
                    average: 0,
                    status: 'active'
                },
                {
                    id: 18613034229,
                    base: 'BTC',
                    quote: 'USDT',
                    operation: 'buy',
                    amount: 0.002,
                    remain: 0.002,
                    price: 0.00001,
                    average: 0,
                    status: 'active'
                }
            ]
        }
    }
};