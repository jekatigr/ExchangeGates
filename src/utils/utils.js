const timeout = delay => (
    new Promise((r) => {
        setInterval(r, delay);
    })
);

/**
 * Делит массив на части с количеством элементов не более maxCount
 * @param arr
 * @param maxCount
 */
const makeChunks = (arr = [], maxCount = 1) => {
    const num = Math.floor(arr.length / maxCount) + 1;
    const res = [];
    for (let i = 0; i < num; i++) {
        const start = i * maxCount;
        const end = ((i + 1) * maxCount < arr.length) ? (i + 1) * maxCount : arr.length;
        const chunk = arr.slice(start, end);
        if (chunk.length > 0) {
            res.push(chunk);
        }
    }
    return res;
};

module.exports = {
    timeout,
    makeChunks
};