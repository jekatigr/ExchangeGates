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

const getFormattedDate = (date = new Date()) => {
    const h = (`0${date.getHours()}`).slice(-2);
    const m = (`0${date.getMinutes()}`).slice(-2);
    const s = (`0${date.getSeconds()}`).slice(-2);
    const ms = (`0${date.getMilliseconds()}`).slice(-3);
    const d = (`0${date.getDate()}`).slice(-2);
    const mn = (`0${(date.getMonth() + 1)}`).slice(-2);
    const y = date.getFullYear();

    return `${d}.${mn}.${y} ${h}:${m}:${s}.${ms}`;
};

module.exports = {
    timeout,
    makeChunks,
    getFormattedDate
};