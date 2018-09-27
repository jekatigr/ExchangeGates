const TidexApi = require('./tidex-api');

const api = new TidexApi();

(async () => {

    const res = await api.getOrderBooks(/*['BTC/USDT']*/);
    console.log(res);

})();
