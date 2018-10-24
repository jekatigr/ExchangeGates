const https = require ('https');
const ccxt = require('ccxt');
const ExchangeServiceAbstract = require('./ExchangeServiceAbstract');
const fillBalancesWithMainAmount = require('../utils/BalancesUtil');
const { getPrices } = require('../utils/PriceUtil');
const AdjacencyMatrixUtil = require('../utils/AdjacencyMatrixUtil');
const { getConfig } = require('../ConfigLoader');

module.exports = class HuobiApiService extends ExchangeServiceAbstract {
    constructor() {
        const config = getConfig();
        const { exchange, apiKey, apiSecret, ipArray } = config;

        super(exchange, ipArray);

        this.api = new ccxt.huobipro({
            apiKey: apiKey,
            secret: apiSecret,
            enableRateLimit: false,
            timeout: 10000
        });
    }

    rotateAgent() {
        this.api.agent = https.Agent({
            localAddress: this.getNextIp()
        });
    }

    async getMarkets() {
        try {
            this.rotateAgent();
            const markets = await this.api.loadMarkets();

            const res = [];
            for (let marketId in markets) {
                let market = markets[marketId];
                const { base, quote, precision, taker, maker, limits } = market;
                res.push({
                    base,
                    quote,
                    precision,
                    taker,
                    maker,
                    limits
                })
            }
            return res;
        } catch (ex) {
            console.log(`Exception while fetching markets, ex: ${ex}, stacktrace: ${ex.stack}`);
            throw new Error(`Exception while fetching markets, ex: ${ex}`);
        }
    }

    async getTriangles() {
        try {
            const config = getConfig();
            const { currencies } = config;

            const markets = await this.getMarkets();

            // создаем матрицу смежности
            const matrix = AdjacencyMatrixUtil.fillAdjacencyMatrixForCurrencies(markets, currencies);

            const triangles = [];

            for (let a = 0; a < currencies.length; a++) {
                for (let b = a + 1; b < currencies.length; b++) {
                    if (matrix[a][b] !== 0) {
                        for (let c = b + 1; c < currencies.length; c++) {
                            if (matrix[b][c] === 1 && matrix[a][c] === 1) {
                                triangles.push([ currencies[a], currencies[b], currencies[c] ]);
                                triangles.push([ currencies[a], currencies[c], currencies[b] ]);
                                triangles.push([ currencies[b], currencies[a], currencies[c] ]);
                                triangles.push([ currencies[b], currencies[c], currencies[a] ]);
                                triangles.push([ currencies[c], currencies[a], currencies[b] ]);
                                triangles.push([ currencies[c], currencies[b], currencies[a] ]);
                            }
                        }
                    }
                }
            }

            return triangles;
        } catch (ex) {
            console.log(`Exception while fetching triangles, ex: ${ex}, stacktrace: ${ex.stack}`);
            throw new Error(`Exception while fetching triangles, ex: ${ex}`);
        }
    }
};