const TidexApi = require('./tidex-api');

const api = new TidexApi();

(async () => {

    const res = await api.getTrades(/*['BTC/USDT']*/);
    console.log(res);

})();
