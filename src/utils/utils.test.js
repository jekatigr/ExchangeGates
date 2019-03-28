const { makeChunks } = require('./utils');

describe('makeChunks', () => {
    it('test 1', () => {
        const arr = [ 1, 2, 3, 4, 5, 6 ];
        const max = 3;
        const expected = [
            [1, 2, 3],
            [4, 5, 6]
        ];
        const result = makeChunks(arr, max);
        expect(result).toEqual(expected);
    });

    it('test 2', () => {
        const arr = [ 1, 2, 3, 4, 5, 6, 7 ];
        const max = 3;
        const expected = [
            [1, 2, 3],
            [4, 5, 6],
            [7]
        ];
        const result = makeChunks(arr, max);
        expect(result).toEqual(expected);
    });

    it('test 3', () => {
        const arr = [];
        const max = 3;
        const expected = [];
        const result = makeChunks(arr, max);
        expect(result).toEqual(expected);
    });

    it('test 4', () => {
        const arr = [ 1, 2, 3, 4, 5, 6, 7 ];
        const max = 4;
        const expected = [
            [1, 2, 3, 4],
            [5, 6, 7]
        ];
        const result = makeChunks(arr, max);
        expect(result).toEqual(expected);
    });
});