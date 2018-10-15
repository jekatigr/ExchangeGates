
function getConfig() {
    return {
        apiKey: '123',
        apiSecret: '456',
        mainCurrency: 'USDT'
    };
}

async function loadConfig() {
    return { success: true };
}

module.exports = {
    getConfig,
    loadConfig
};