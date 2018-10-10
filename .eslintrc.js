module.exports = {
    extends: [
        "airbnb-base",
        "plugin:jest/recommended"
    ],
    rules: {
        "linebreak-style": 0,
        "indent": ["error", 4, {
            "SwitchCase": 1
        }],
        "comma-dangle": ["error", {
            "arrays": "only-multiline",
            "objects": "only-multiline",
            "imports": "never",
            "exports": "never",
            "functions": "ignore"
        }],
        "eol-last": 0,
        "no-plusplus": ["error", {
            "allowForLoopAfterthoughts": true
        }],
        "max-len": ["error", {
            "code": 120,
            "ignoreStrings": true
        }],
        "object-curly-newline": ["error", {"consistent": true}],
        "no-console": 0,
        "one-var": 0,
        "one-var-declaration-per-line": ["error", "initializations"],
        "array-bracket-spacing": ["error", "always", {
            "singleValue": false,
            "objectsInArrays": false,
            "arraysInArrays": false
        }],
        "prefer-const": ["error", {"destructuring": "all"}],
        "no-restricted-syntax": ["error", {
            selector: 'ForInStatement',
            message: 'for..in loops iterate over the entire prototype chain, which is virtually never what you want. Use Object.{keys,values,entries}, and iterate over the resulting array.',
        },
            {
                selector: 'LabeledStatement',
                message: 'Labels are a form of GOTO; using them makes code confusing and hard to maintain and understand.',
            },
            {
                selector: 'WithStatement',
                message: '`with` is disallowed in strict mode because it makes code impossible to predict and optimize.',
            }
        ],
    },
    plugins: [
        'import',
        'jest'
    ],
    env: {
        node: true,
        'jest/globals': true
    },
};