const fs = require('fs');
const SupportedExchanges = require('./constants/Exchanges');

let CONFIG;

function getConfig() {
    return CONFIG;
}

function getFileContent(path) {
    return new Promise((resolve, reject) => {
        fs.readFile(path, 'utf8', (err, data) => {
            if (err) {
                reject(err);
            } else {
                resolve(data);
            }
        });
    });
}

async function loadConfig(path) {
    let fileContent, configObj;
    try {
        fileContent = await getFileContent(path);
    } catch (e) {
        return {
            success: false,
            error: `File "${path}" not found`
        };
    }

    try {
        configObj = JSON.parse(fileContent);
    } catch (e) {
        return {
            success: false,
            error: 'Config file has wrong format'
        };
    }

    if (!configObj.exchange || configObj.exchange === '') {
        return {
            success: false,
            error: "Config file doesn't have 'exchange'"
        };
    }

    if (!Object.values(SupportedExchanges).includes(configObj.exchange)) {
        return {
            success: false,
            error: "'exchange' config option is wrong"
        };
    }

    if (!configObj.mainCurrency || configObj.mainCurrency === '') {
        return {
            success: false,
            error: "Config file doesn't have 'mainCurrency'"
        };
    }

    if (!configObj.currencies || configObj.currencies.length === 0) {
        return {
            success: false,
            error: "Config file doesn't have 'currencies'"
        };
    }

    if (!configObj.apiKey || configObj.apiKey === '') {
        return {
            success: false,
            error: "Config file doesn't have 'apiKey'"
        };
    }

    if (!configObj.apiSecret || configObj.apiSecret === '') {
        return {
            success: false,
            error: "Config file doesn't have 'apiSecret'"
        };
    }

    CONFIG = configObj;
    return { success: true };
}

module.exports = {
    getConfig,
    loadConfig
};