const TidexApi = require('../index');

const Market = require('../models/Market');
const Ticker = require('../models/Ticker');
const OrderBook = require('../models/OrderBook');
const Trades = require('../models/Trades');
const Trade = require('../models/Trade');

const api = new TidexApi();

describe('Tidex API', () => {
    afterEach(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
    });

    it('should create api instance', () => {
        expect(api).toBeInstanceOf(TidexApi);
    });

    it('should load and return markets', async () => {
        api.markets = undefined;
        expect(api.markets).toBeUndefined();
        const markets = await api.getMarkets();
        expect(api.markets).toBeInstanceOf(Array);
        expect(markets).toBeInstanceOf(Array);
        expect(markets.length).toBeGreaterThan(0);
        markets.forEach(m => expect(m).toBeInstanceOf(Market));
    });

    describe('fetch tickers', () => {
        it('should not load markets before fetch if symbols provided', async () => {
            api.markets = undefined;
            expect(api.markets).toBeUndefined();
            const tickers = await api.getTickers([ 'BCH/ETH' ]);
            expect(api.markets).toBeUndefined();
        });

        it('should load markets before fetch', async () => {
            api.markets = undefined;
            expect(api.markets).toBeUndefined();
            const tickers = await api.getTickers();
            expect(api.markets).toBeInstanceOf(Array);
            api.markets.forEach(m => expect(m).toBeInstanceOf(Market));
        });

        it('should fetch all', async () => {
            const tickers = await api.getTickers();
            expect(tickers).toBeInstanceOf(Array);
            expect(tickers.length).toBeGreaterThan(0);
            tickers.forEach(t => expect(t).toBeInstanceOf(Ticker));
        });

        it('should fetch two', async () => {
            const markets = await api.getMarkets();
            const symbols = markets.slice(0, 2).map(m => `${m.base}/${m.quote}`);

            const tickers = await api.getTickers(symbols);
            expect(tickers).toBeInstanceOf(Array);
            expect(tickers).toHaveLength(2);
            tickers.forEach(t => expect(t).toBeInstanceOf(Ticker));
        });
    });

    describe('fetch orderbooks', () => {
        it('should not load markets before fetch if symbols provided', async () => {
            api.markets = undefined;
            expect(api.markets).toBeUndefined();
            const tickers = await api.getOrderBooks({ symbols: [ 'BCH/ETH' ] });
            expect(api.markets).toBeUndefined();
        });

        it('should load markets before fetch', async () => {
            api.markets = undefined;
            expect(api.markets).toBeUndefined();
            const orderbooks = await api.getOrderBooks();
            expect(api.markets).toBeInstanceOf(Array);
            expect(api.markets.length).toBeGreaterThan(0);
            api.markets.forEach(m => expect(m).toBeInstanceOf(Market));
        });

        it('should fetch all', async () => {
            const orderbooks = await api.getOrderBooks();
            expect(orderbooks).toBeInstanceOf(Array);
            expect(orderbooks.length).toBeGreaterThan(0);
            orderbooks.forEach(o => expect(o).toBeInstanceOf(OrderBook));
        });

        it('should fetch three', async () => {
            const markets = await api.getMarkets();
            const symbols = markets.slice(0, 3).map(m => `${m.base}/${m.quote}`);

            const orderbooks = await api.getOrderBooks({ symbols });
            expect(orderbooks).toBeInstanceOf(Array);
            expect(orderbooks).toHaveLength(3);
            orderbooks.forEach(o => expect(o).toBeInstanceOf(OrderBook));
        });

        it('should throw error about max limit', async () => {
            const markets = await api.getMarkets();
            const symbols = markets.slice(0, 2).map(m => `${m.base}/${m.quote}`);

            const method = api.getOrderBooks({ limit: 2001, symbols });
            await expect(method).rejects.toThrow('Max limit for orderbook is 2000.');
        });

        it('should fetch two with limit 5', async () => {
            const markets = await api.getMarkets();
            const symbols = markets.slice(0, 2).map(m => `${m.base}/${m.quote}`);

            const orderbooks = await api.getOrderBooks({ limit: 5, symbols });
            expect(orderbooks).toBeInstanceOf(Array);
            expect(orderbooks).toHaveLength(2);
            orderbooks.forEach(o => {
                expect(o).toBeInstanceOf(OrderBook);
                expect(o.bids).toBeInstanceOf(Array);
                expect(o.asks).toBeInstanceOf(Array);
                expect(o.bids.length).toBeLessThanOrEqual(5);
                expect(o.asks.length).toBeLessThanOrEqual(5);
            });
        });
    });

    describe('fetch trades', () => {
        it('should not load markets before fetch if symbols provided', async () => {
            api.markets = undefined;
            expect(api.markets).toBeUndefined();
            const tickers = await api.getTrades({ symbols: [ 'BCH/ETH' ] });
            expect(api.markets).toBeUndefined();
        });

        it('should load markets before fetch', async () => {
            api.markets = undefined;
            expect(api.markets).toBeUndefined();
            const trades = await api.getTrades();
            expect(api.markets).toBeInstanceOf(Array);
            expect(api.markets.length).toBeGreaterThan(0);
            api.markets.forEach(m => expect(m).toBeInstanceOf(Market));
        });

        it('should fetch all', async () => {
            const trades = await api.getTrades();
            expect(trades).toBeInstanceOf(Array);
            expect(trades.length).toBeGreaterThan(0);
            trades.forEach(o => {
                expect(o).toBeInstanceOf(Trades);
                expect(o.trades).toBeInstanceOf(Array);
                o.trades.forEach(t => expect(t).toBeInstanceOf(Trade));
            });
        });

        it('should fetch three', async () => {
            const markets = await api.getMarkets();
            const symbols = markets.slice(0, 3).map(m => `${m.base}/${m.quote}`);

            const trades = await api.getTrades({ symbols });
            expect(trades).toBeInstanceOf(Array);
            expect(trades).toHaveLength(3);
            trades.forEach(o => {
                expect(o).toBeInstanceOf(Trades);
                expect(o.trades).toBeInstanceOf(Array);
                o.trades.forEach(t => expect(t).toBeInstanceOf(Trade));
            });
        });

        it('should throw error about max limit', async () => {
            const markets = await api.getMarkets();
            const symbols = markets.slice(0, 2).map(m => `${m.base}/${m.quote}`);

            const method = api.getTrades({ limit: 2001, symbols });
            await expect(method).rejects.toThrow('Max limit for trades is 2000.');
        });

        it('should fetch two with limit 5', async () => {
            const markets = await api.getMarkets();
            const symbols = markets.slice(0, 2).map(m => `${m.base}/${m.quote}`);

            const trades = await api.getTrades({ limit: 5, symbols });
            expect(trades).toBeInstanceOf(Array);
            expect(trades).toHaveLength(2);
            trades.forEach(o => {
                expect(o).toBeInstanceOf(Trades);
                expect(o.trades).toBeInstanceOf(Array);
                expect(o.trades.length).toBeLessThanOrEqual(5);
                o.trades.forEach(t => expect(t).toBeInstanceOf(Trade));
            });
        });
    });
});