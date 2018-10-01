const fs = require('fs');

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
    let fileContent, configObj, res;
    try {
        fileContent = await getFileContent(path);
    } catch (e) {
        return {
            success: false,
            error: `File "${path}" not found.`
        };
    }

    try {
        configObj = JSON.parse(fileContent);
    } catch (e) {
        return {
            success: false,
            error: 'Config file has wrong format.'
        };
    }

    if (!configObj.mainCurrency || configObj.mainCurrency === '') {
        return {
            success: false,
            error: "config.json doesn't have 'mainCurrency'"
        };
    }

    if (!configObj.currencies || configObj.currencies.length === 0) {
        return {
            success: false,
            error: "config.json doesn't have 'currencies'"
        };
    }

    CONFIG = configObj;
    return { success: true };
}

module.exports = {
    getConfig,
    loadConfig
};