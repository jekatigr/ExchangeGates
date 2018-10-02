const timeout = (delay) => {
    return new Promise(r => {
        setInterval(r, delay);
    })
};

module.exports = {
    timeout
};