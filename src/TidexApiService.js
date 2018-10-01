const TidexApi = require('node-tidex-api');

const { API_KEY, API_SECRET } = process.env;

const api = new TidexApi({
    apiKey: API_KEY,
    apiSecret: API_SECRET
});

//
// const generateTriangles = (markets) => {
//     let quotes = {};
//     for (let m of markets) {
//         if (!quotes[m.quote]) {
//             quotes[m.quote] = [];
//         }
//         quotes[m.quote].push(m.base);
//     }
//
//     let q = Object.keys(quotes);
//
//     let res = [];
//     for (let i = 0; i < q.length; i++) {
//         for (let j = 0; j < q.length; j++) {
//             if (i !== j) {
//                 let token1 = q[i];
//                 let token3 = q[j];
//                 let cross = quotes[token1].filter(b => quotes[token3].includes(b));
//                 cross.forEach(e => res.push([token1, e, token3]));
//             }
//         }
//     }
//     return res;
// };

const getMarkets = async () => {
    return await api.getMarkets();
};

const getBalances = async () => {
    const { balances } = await api.getAccountInfoExtended();
    return balances;
};

module.exports = {
    getMarkets,
    getBalances
};