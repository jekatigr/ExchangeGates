const timeout = delay => (
    new Promise((r) => {
        setInterval(r, delay);
    })
);

const buildPath = (parents, targetNode) => {
    const result = [targetNode];
    let target = targetNode;
    while (parents[target] !== null) {
        target = parents[target];
        result.push(target);
    }
    return result.reverse();
};

/**
 * Breath-First graph searching algorithm.
 * Returns the shortest path between startNode and targetNode.<br><br>
 * Time complexity: O(|V|^2).
 *
 * @param {Array} graph Adjacency matrix, which represents the graph.
 * @param {Number} startNode Start node.
 * @param {Number} targetNode Target, which should be reached.
 * @returns {Array} Shortest path from startNode to targetNode.
 *
 * @example
 * var graph = [[1, 1, 0, 0, 1, 0],
 *              [1, 0, 1, 0, 1, 0],
 *              [0, 1, 0, 1, 0, 0],
 *              [0, 0, 1, 0, 1, 1],
 *              [1, 1, 0, 1, 0, 0],
 *              [0, 0, 0, 1, 0, 0]];
 * var shortestPath = bfs(graph, 1, 5); // [1, 2, 3, 5]
 */
const bfs = (graph, startNode, targetNode) => {
    const parents = [];
    const queue = [];
    const visited = [];
    let current;
    queue.push(startNode);
    parents[startNode] = null;
    visited[startNode] = true;
    while (queue.length) {
        current = queue.shift();
        if (current === targetNode) {
            return buildPath(parents, targetNode);
        }
        for (let i = 0; i < graph.length; i += 1) {
            if (i !== current && graph[current][i] && !visited[i]) {
                parents[i] = current;
                visited[i] = true;
                queue.push(i);
            }
        }
    }
    return null;
};

module.exports = {
    timeout,
    bfs
};