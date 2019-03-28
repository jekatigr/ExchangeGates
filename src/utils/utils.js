const timeout = delay => (
    new Promise((r) => {
        setInterval(r, delay);
    })
);

module.exports = {
    timeout
};