# Exchange Gates

> Unified JavaScript and WebSocket interface for cryptoexchanges.

Russian documentation is [here](./README_RU.md).

### Supported exchanges

- Bibox ([bibox.com](https://bibox.com))
- Binance ([binance.com](https://binance.com))
- Bitfinex ([bitfinex.com](https://bitfinex.com))
- Huobi ([huobi.pro](https://huobi.pro))
- Tidex ([tidex.com](https://tidex.com))
- Okex ([okex.com](https://www.okex.com))

*****

### Configuration

To run ws server you need to create a config file with params:

Name | Type | Required | Default | Description
-------- |--- | ------------ | -------- | --------
wsPort | Number | no | 2345 | Port for ws server.
exchange| String | yes | - | One of: bibox, binance, bitfinex, huobi, tidex, okex.
apiKey| String |yes|-|Api key.
apiSecret| String |yes|-|Api secret.
passphrase| String |no*|-|Passphrase for okex api (required for okex).
ipArray| Array<String\> |no|External ip|Array of ip addresses, from which all requests will be sent.

Example of config file::

    {
        "wsPort": 2345,
        "exchange": "tidex",
        "apiKey": "UFRFIREFONREIVONREIOVNREOVRENVINO",
        "apiSecret": "vgyewjnimkoxoerjnbhcxkoeijnhvbijnkmwnrjhevbjcn",
        "ipArray": [
            "192.32.32.12",
            "173.32.45.34"
        ]
    }

***** 

### Install and run

Installation:

    yarn --prod
    
Run:

    cross-env CONFIG_FILE_PATH='<config_file_path>' node index.js

Or:

    yarn run start-bibox
    yarn run start-binance
    yarn run start-bitfinex
    yarn run start-huobi
    yarn run start-tidex
    yarn run start-okex

*****

### Interaction format

All requests to the ws should have json format:

    { 
        "action": "<method name>", 
        "params": <parameters>
    }

Responses also will be in json:

    {
        "success": true or false
        "event": string with event name
        "action": string with method name. Will be in response only after client's actions.
        "data": data object
        "timestampStart": timestamp of event excecution start
        "timestampEnd": timestamp of event execution end
    }

Possible events:

- action
- orderbooks
- connected
- availableActions

After opening a connection with ws server will send two 
messages: connected и availableActions. After that server will wait command from client.

#### Request id

Client-defined _id_ can be added in any command. This _id_ will 
be returned in response to this command. For example:


Request:

    { 
        "action": "getMarkets", 
        "id": "myUniqueId" 
    }
    
Response:
    
    {
        "success": true
        "id": "myUniqueId",
        "event": "action"
        "action": "getMarkets"
        "data": [...]
        "timestampStart": 15345654565435,
        "timestampEnd": 15345654565435
    }

***** 

### Available methods

- [getMarkets](#getmarkets)
- [connectToExchange](#connecttoexchange)
- [getOrderbooks](#getorderbooks)
- [runOrderbooksNotifier](#runorderbooksnotifier)
- [stopOrderbooksNotifier](#stoporderbooksnotifier)
- [getBalances](#getbalances)
- [createOrder](#createorder)
- [getActiveOrders](#getactiveorders)
- [getOrder](#getorder)
- [cancelOrder](#cancelorder)
- [getDepositAddress](#getdepositaddress)
- [withdraw](#withdraw)
- [shutdown](#shutdown)

***** 

#### getMarkets

Method returns an array with market info: precision, fees and order limits.

Example:

```json
{
    "action": "getMarkets"
}
```

<details>
<summary>Output:</summary>

```json
{  
    "success": true,
    "timestampStart": 1542653239347,
    "timestampEnd": 1542653239348,
    "event": "action",
    "action": "getMarkets",
    "data": [  
    {  
        "base": "BIX",
        "quote": "BTC",
        "precision": {  
            "amount": 4,
            "price": 8
        },
        "taker": 0.001,
        "maker": 0,
        "limits": {  
            "amount": {  
                "min": 0.0001
            },
            "price": {  
                "max": 10000
            }
        }
    },
    {  
        "base": "BIX",
        "quote": "ETH",
        "precision": {  
            "amount": 4,
            "price": 8
        },
        "taker": 0.001,
        "maker": 0,
        "limits": {  
            "amount": {  
                "min": 0.0001
            },
            "price": {  
                "min": 0.0001
            }
        }
    },
    ...
    ]
}
```
</details>

*****

#### connectToExchange

Method for initialization of websocket-connections to exchange for receiving orderbooks.

It should be called before using methods **getOrderbooks** and **runOrderbooksNotifier**.

|Name|Type|Required|Default|Description|
|--- |--- |--- |--- |--- |
|params|Array<String\>|No|All markets|Markets list.

Example:

```json
{
    "action": "connectToExchange",
    "params": [
        "BTC/USDT",
        "ETH/USDT"
    ]
}
```

<details>
<summary>Output:</summary>

```json
{  
    "success": true,
    "timestampStart": 1542712136234,
    "timestampEnd": 1542712136235,
    "event": "action",
    "action": "connectToExchange"
}
```

</details>

*****

#### getOrderbooks

Method returns an array of orderbooks.

Before using **connectToExchange** method should be called (only one time during process run).

Markets in _symbols_ parameter should be included in 
parameters of **connectToExchange** call, otherwise server will return only data from initialized markets.

|Name|Type|Required|Default|Description|
|--- |--- |--- |--- |--- |
|symbols|Array<String\>|No|All initialized markets|Markets list.
|limit|Number|No|1|Size of asks and bids arrays.

Example:

```json
{
    "action": "getOrderbooks",
    "params": {
        "symbols": [
            "BTC/USDT",
            "ETH/USDT"
        ],
        "limit": 2
    }
}
```

<details>
<summary>Output:</summary>

```json
{  
    "success": true,
    "timestampStart": 1542712136234,
    "timestampEnd": 1542712136235,
    "event": "action",
    "action": "getOrderbooks",
    "data": [  
        {  
            "base": "BTC",
            "quote": "USDT",
            "bids": [  
                {  
                    "price": 4565.4795,
                    "amount": 0.0007
                },
                {  
                    "price": 4565.479,
                    "amount": 0.0236
                }
            ],
            "asks": [  
                {  
                    "price": 4576.482,
                    "amount": 0.0097
                },
                {  
                    "price": 4576.4828,
                    "amount": 0.0265
                }
            ]
        },
        {  
            "base": "ETH",
            "quote": "USDT",
            "bids": [  
                {  
                    "price": 136.8994,
                    "amount": 3.3363
                },
                {  
                    "price": 136.5557,
                    "amount": 0.08
                }
            ],
            "asks": [  
                {  
                    "price": 137.064,
                    "amount": 0.0116
                },
                {  
                    "price": 137.14,
                    "amount": 0.3
                }
            ]
        }
    ]
}
```

</details>

***** 

#### runOrderbooksNotifier

Launch of notifications with updated orderbooks.

After call server will send first message with all orderbooks (for markets in _symbols_ parameter). 
Second and following messages will include only updated orderbooks.

Before using **connectToExchange** method should be called (only one time during process run).

Markets in _symbols_ parameter should be included in 
parameters of **connectToExchange** call, otherwise server will return only data from initialized markets.

 
|Name|Type|Required|Default|Description|
|--- |--- |--- |--- |--- |
|symbols|Array<String\>|No|All initialized markets|Markets list.
|limit|Number|No|1|Size of asks and bids arrays.

Example:

```json
{
    "action": "runOrderbooksNotifier",
    "params": {
        "symbols": [
            "BTC/USDT",
            "ETH/USDT"
        ],
        "limit": 2
    }
}
```

<details>
<summary>Output:</summary>

```json
{  
    "success": true,
    "timestampStart": 1542716478922,
    "timestampEnd": 1542716478924,
    "event": "orderbooks",
    "data": [  
        {  
            "base": "ETH",
            "quote": "USDT",
            "bids": [  
                {  
                    "price": 137.3621,
                    "amount": 0.0276
                },
                {  
                    "price": 137.362,
                    "amount": 0.3478
                }
            ],
            "asks": [  
                {  
                    "price": 137.6042,
                    "amount": 0.0971
                },
                {  
                    "price": 137.635,
                    "amount": 0.303
                }
            ]
        },
        {  
            "base": "BTC",
            "quote": "USDT",
            "bids": [  
                {  
                    "price": 4604.2046,
                    "amount": 0.0505
                },
                {  
                    "price": 4603.0002,
                    "amount": 0.0075
                }
            ],
            "asks": [  
                {  
                    "price": 4618.3048,
                    "amount": 0.0003
                },
                {  
                    "price": 4619.4653,
                    "amount": 0.0304
                }
            ]
        }
    ]
}
```

</details>

*****

#### stopOrderbooksNotifier

Stop notifications with updated orderbooks.

Example:

```json
{
    "action": "stopOrderbooksNotifier"
}
```

<details>
<summary>Output:</summary>

```json
{  
    "success": true,
    "timestampStart": 1542712136234,
    "timestampEnd": 1542712136235,
    "event": "action",
    "action": "stopOrderbooksNotifier"
}
```

</details>

*****

#### getBalances

Method returns wallets balance.

|Name|Type|Required|Default|Description|
 |--- |--- |--- |--- |--- |
 |params|Array<String\>|No|All wallets|Currencies list.

Example:

```json
{
    "action": "getBalances",
    "params": [
        "BTC",
        "ETH",
        "USDT"
    ]
}
```

<details>
<summary>Output:</summary>

```json
{  
    "success": true,
    "timestampStart": 1542718516618,
    "timestampEnd": 1542718517159,
    "event": "action",
    "action": "getBalances",
    "data": [  
        {  
            "currency": "ETH",
            "free": 0.03006757,
            "used": 0,
            "total": 0.03006757
        },
        {  
            "currency": "USDT",
            "free": 20,
            "used": 10,
            "total": 30
        }
    ]
}
```

</details>

*****

#### createOrder

Create limit order.

|Name|Type|Required|Description|
 |--- |--- |--- |--- |
 |symbol|String|Yes|Market.
 |operation|String|Yes|"buy" or "sell".
 |price|Number|Yes|Price.
 |amount|Number|Yes|Amount.
 |cancelAfter|Number|No|Time in ms. Server will try to cancel the order after delay.

Example:

```json

{
    "action": "createOrder",
    "params": {
        "symbol": "ETH/USDT",
        "operation": "sell",
        "price": 210,
        "amount": 0.011,
        "cancelAfter": 10000
    }
}
```

<details>
<summary>Output:</summary>

```json
{  
    "success": true,
    "timestampStart": 1542719064085,
    "timestampEnd": 1542719064590,
    "event": "action",
    "action": "createOrder",
    "data": {  
        "id": "1212073888",
        "base": "ETH",
        "quote": "USDT",
        "operation": "sell",
        "amount": 0.011,
        "remain": 0.011,
        "price": 210,
        "average": 0,
        "created": 1542719064590,
        "status": "active"
    }
}
```

</details>

*****

#### getActiveOrders

Method returns an array of active orders.

|Name|Type|Required|Default|Description|
 |--- |--- |--- |--- |--- |
 |params|String|No*|All markets|Market.

_\* required for Binance_

Example:

```json
{
    "action": "getActiveOrders",
    "params": "ETH/USDT"
}
```

<details>
<summary>Output:</summary>

```json
{  
    "success": true,
    "timestampStart": 1542719411930,
    "timestampEnd": 1542719412486,
    "event": "action",
    "action": "getActiveOrders",
    "data": [  
        {  
            "id": "1212074575",
            "base": "ETH",
            "quote": "USDT",
            "operation": "sell",
            "amount": 0.011,
            "remain": 0.011,
            "price": 210,
            "average": 0,
            "created": 1542719077000,
            "status": "active"
        }
    ]
}
```

</details>

*****

#### getOrder

Method return order details.

|Name|Type|Required|Description|
 |--- |--- |--- |--- |
 |symbol|String|Yes|Market.
 |id|String/Number|Yes|Order id.

Example:

```json
{
    "action": "getOrder",
    "params": {
        "symbol": "ETH/USDT",
        "id": "1212100295"
    }
}
```

<details>
<summary>Output:</summary>

```json
{  
    "success": true,
    "timestampStart": 1542719586867,
    "timestampEnd": 1542719587697,
    "event": "action",
    "action": "getOrder",
    "data": {  
            "id": "1212100295",
            "base": "ETH",
            "quote": "USDT",
            "operation": "sell",
            "amount": 0.011,
            "remain": 0.011,
            "price": 220,
            "average": 0,
            "created": 1542719561000,
            "status": "active"
    }
}
```

</details>

*****

#### cancelOrder

Order cancellation.

|Name|Type|Required|Description|
 |--- |--- |--- |--- |
 |symbol|String|Yes|Market.
 |id|String/Number|Yes|Order id.

Example:

```json
{
    "action": "cancelOrder",
    "params": {
        "symbol": "ETH/USDT",
        "id": "1212100295"
    }
}
```

<details>
<summary>Output:</summary>

```json
{  
    "success": true,
    "timestampStart": 1542719952740,
    "timestampEnd": 1542719953566,
    "event": "action",
    "action": "cancelOrder"
}
```

</details>

*****

#### getDepositAddress

**Available only for Bitfinex**

Method returns an address for asset deposit.

|Name|Type|Required|Description|
 |--- |--- |--- |--- |
 |params|String|Yes|Currency.

Example:

```json
{
    "action": "getDepositAddress",
    "params": "BTC"
}
```

<details>
<summary>Output:</summary>

```json
{  
    "success": true,
    "timestampStart": 1542718516618,
    "timestampEnd": 1542718517159,
    "event": "action",
    "action": "getDepositAddress",
    "data": "1KVrU6ZAVCU8sd5benEemmng967pgsDiat"
}
```

</details>

*****

#### withdraw

**Available only for Bitfinex and Huobi**

Withdraw assets. Returns request id.

|Name|Type|Required|Description|
 |--- |--- |--- |--- |
 |currency|String|Yes|Currency.
 |address|String|Yes|Address.
 |amount|Number|Yes|Amount.
 
Example:

```json

{
    "action": "withdraw", 
    "params": {
        "address": "1KVrU6ZAVCU8sd5benEemmng967pgsDiat",
        "currency": "BTC",
        "amount": 0.071
    }
}
```

<details>
<summary>Output:</summary>

```json
{  
    "success": true,
    "timestampStart": 1542719064085,
    "timestampEnd": 1542719064590,
    "event": "action",
    "action": "withdraw",
    "data": 12234543
}
```

</details>

*****

#### shutdown

Service shutdown.
 
Example:

```json

{
    "action": "shutdown"
}
```

There is no response for this method.