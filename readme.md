# CryptoExchanges Data Provider

> Единый websocket-интерфейс к криптобиржам.


### Поддерживаемые биржи

- Bibox ([bibox.com](https://bibox.com))
- Bitfinex ([bitfinex.com](https://bitfinex.com))
- Huobi ([huobi.pro](https://huobi.pro))
- Tidex ([tidex.com](https://tidex.com))
- Okex ([okex.com](https://www.okex.com))

*****

### Конфигурация

Для запуска ws-сервера необходимо создать конфигурационный файл. Описание параметров:

Параметр | Тип | Обязательный | По-умолчанию | Описание
-------- |--- | ------------ | -------- | --------
wsPort | Number | нет | 2345 | Порт, на котором будет работать ws-сервер.
exchange| String | да | - | Одно из значений: bibox, bitfinex, huobi, tidex.
apiKey| String |да|-|Api key аккаунта на бирже.
apiSecret| String |да|-|Api secret аккаунта на бирже.
passphrase| String |нет*|-|Passphrase для доступа к okex api (обязательно для okex).
mainCurrency| String |да|-|Главная валюта, к которой будут пересчитываться цены в методе getPrices и getBalances.
ipArray| Array<String\> |нет|Внешний ip|Массив ip-адресов, с которых будут запрашиваться api бирж.
currencies| Array<String\> |да|-|Массив валют, из которых будут строиться треугольники в методе getTriangles.

Пример конфигурационного файла:

    {
        "wsPort": 2345,
        "exchange": "tidex",
        "apiKey": "UFRFIREFONREIVONREIOVNREOVRENVINO",
        "apiSecret": "vgyewjnimkoxoerjnbhcxkoeijnhvbijnkmwnrjhevbjcn",
        "mainCurrency": "USDT",
        "ipArray": [
            "192.32.32.12",
            "173.32.45.34"
        ],
        "currencies": [
            "BTC",
            "USDT",
            "ETH",
            "LTC",
            "RLC",
            "REM"
        ]
    }

***** 

### Установка и запуск

Для установки:

    yarn --prod
    
Для запуска:

    cross-env CONFIG_FILE_PATH='<путь_к_файлу_конфигурации>' node index.js

Либо один из следующих вариантов:

    yarn run start-bibox
    yarn run start-bitfinex
    yarn run start-huobi
    yarn run start-tidex
    yarn run start-okex

*****

### Формат взаимодействия

Все запросы в вебсокет должны приходить в 
формате объекта json: 

    { 
        "action": "<метод>", 
        "params": <параметры> 
    }

Все сообщения от ws-сервера также приходят в json-объекте.

Формат ответа:

    {
        "success": true или false
        "event": строка, содержащая имя события.
        "action": строка с названием метода. Action возвращается в ответе только в случае, когда был запрошен метод с клиента
        "data": объект с данными, либо строка содержащая описание ошибки (когда success = false)
        "timestampStart": время начала работы над событием,
        "timestampEnd": время окончания работы над событием
    }

Возможные варианты event'ов:

- action
- orderbooks
- connected
- availableActions

***** 

### Доступные методы

- [getMarkets](#getmarkets)
- [getOrderBooks](#getorderbooks)
- [runOrderbooksNotifier](#runorderbooksnotifier)
- [stopOrderbooksNotifier](#stoporderbooksnotifier)
- [getPrices](#getprices)
- [getTriangles](#gettriangles)
- [getBalances](#getbalances)
- [createOrder](#createorder)
- [getActiveOrders](#getactiveorders)
- [getOrders](#getorders)
- [getOrders - Okex](#getorders---okex)
- [cancelOrders](#cancelorders)
- [cancelOrders - Okex](#cancelorders---okex)

***** 

#### getMarkets

Метод возвращает массив рынков с указанием точности, комиссий и ограничений при выставлении ордеров.

Пример:

```json
{
    "action": "getMarkets"
}
```

Результат:

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

*****

#### getOrderBooks

Метод возвращает массив ордербуков.

|Параметр|Тип|Обязательный|По-умолчанию|Описание|
|--- |--- |--- |--- |--- |
|symbols|Array<String\>|Нет|Все рынки|Рынки, для которых требуется получить ордербуки.
|limit|Number|Нет|1|Размер массивов asks и bids в результирующих ордербуках.

Пример:

```json
{
    "action": "getOrderBooks",
    "params": {
        "symbols": [
            "BTC/USDT",
            "ETH/USDT"
        ],
        "limit": 2
    }
}
```

Результат:

```json
{  
    "success": true,
    "timestampStart": 1542712136234,
    "timestampEnd": 1542712136235,
    "event": "action",
    "action": "getOrderBooks",
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

***** 

#### runOrderbooksNotifier

Запуск оповещений. После отправки этой команды в ответ 
начинают отправляться ордербуки. При этом:

- в первом сообщении будут отправлены все доступные ордербуки
- в последующих сообщениях будут присылаться только обновленные ордербуки
 
 |Параметр|Тип|Обязательный|По-умолчанию|Описание|
 |--- |--- |--- |--- |--- |
 |symbols|Array<String\>|Нет|Все рынки|Рынки, для которых требуется получать ордербуки.
 |limit|Number|Нет|1|Максимальный размер массивов asks и bids в результирующих ордербуках.

Пример:

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

Результат:

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

*****

#### stopOrderbooksNotifier

Остановка оповещений об обновленных ордербуках.

Пример:

```json
{
    "action": "stopOrderbooksNotifier"
}
```

На данный запрос ответа не предусмотрено.

*****

#### getPrices

Метод возвращает валюты с ценой в главной валюте, которая указана в конфигурационном файле. 
Если валюта не торгуется напрямую к главной, то цена будет пересчитана через другие доступные.

|Параметр|Тип|Обязательный|По-умолчанию|Описание|
 |--- |--- |--- |--- |--- |
 |params|Array<String\>|Нет|Все валюты|Валюты, для которых нужно получить цены.

Пример:

```json
{
    "action": "getPrices",
    "params": [
        "BTC",
        "ETH",
        "USDT"
    ]
}
```

Результат:

```json
{  
    "success": true,
    "timestampStart": 1542717130662,
    "timestampEnd": 1542717130677,
    "event": "action",
    "action": "getPrices",
    "data": [  
        {  
            "base": "BTC",
            "quote": "USDT",
            "ask": 4602.5013,
            "bid": 4598.3804
        },
        {  
            "base": "ETH",
            "quote": "USDT",
            "ask": 137.2765,
            "bid": 137.0117
        },
        {  
            "base": "USDT",
            "quote": "USDT",
            "ask": 1,
            "bid": 1
        }
    ]
}
```

*****  

#### getTriangles

Метод возвращает массив валютных треугольников. 
Список валют берется из конфигурационного файла.

Пример:

```json
{
    "action": "getTriangles"
}
```

Результат:

```json
{  
    "success": true,
    "timestampStart": 1542718048766,
    "timestampEnd": 1542718048773,
    "event": "action",
    "action": "getTriangles",
    "data": [  
        [  
            "BTC",
            "USDT",
            "ETH"
        ],
        [  
            "BTC",
            "ETH",
            "USDT"
        ],
        [  
            "USDT",
            "BTC",
            "ETH"
        ],
        [  
            "USDT",
            "ETH",
            "BTC"
        ],
        ...
    ]
}
```

*****

#### getBalances

Метод возвращает балансы кошельков на бирже. В балансах 
также указывается соответствующий размер кошелька в главной валюте (mainAmount).

|Параметр|Тип|Обязательный|По-умолчанию|Описание|
 |--- |--- |--- |--- |--- |
 |params|Array<String\>|Нет|Все кошельки|Валюты, для которых нужно получить балансы кошельков.

Пример:

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

Результат:

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
            "total": 0.03006757,
            "mainAmount": 4.140917767428
        },
        {  
            "currency": "USDT",
            "free": 20,
            "used": 10,
            "total": 30,
            "mainAmount": 30
        }
    ]
}
```

*****

#### createOrder

Создание лимитного ордера на бирже.

|Параметр|Тип|Обязательный|Описание|
 |--- |--- |--- |--- |
 |symbol|String|Да|Рынок.
 |operation|String|Да|Операция - "buy" или "sell".
 |price|Number|Да|Цена.
 |amount|Number|Да|Количество.
 |cancelAfter|Number|Нет|Время в миллисекундах, после которого ордер будет отменен.

Пример:

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

Результат:

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

*****

#### getActiveOrders

Метод возвращает массив активных ордеров.

|Параметр|Тип|Обязательный|По-умолчанию|Описание|
 |--- |--- |--- |--- |--- |
 |params|String|Нет|Все рынки|Рынок, для которого нужно получить активные ордера.

Пример:

```json
{
    "action": "getActiveOrders",
    "params": "ETH/USDT"
}
```

Результат:

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

*****

#### getOrders

**Описание ниже для всех бирж кроме okex!**

Метод возвращает массив ордеров по id.

|Параметр|Тип|Обязательный|Описание|
 |--- |--- |--- |--- |
 |params|Array<String/Number\>|Да|Массив id ордеров.

Пример:

```json
{
    "action": "getOrders",
    "params": [
        1212100295,
        "1212074575"
    ]
}
```

Результат:

```json
{  
    "success": true,
    "timestampStart": 1542719586867,
    "timestampEnd": 1542719587697,
    "event": "action",
    "action": "getOrders",
    "data": [  
        {  
            "success": true,
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
        },
        {  
            "success": true,
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

*****

#### getOrders - Okex

**Описание только для okex!**

Метод возвращает массив ордеров.

|Параметр|Тип|Обязательный|Описание|
 |--- |--- |--- |--- |
 |params|Array<Object\>|Да|Параметры ордеров.
 
 Где каждый объект в массвие params содержит:
 
 |Параметр|Тип|Обязательный|Описание|
  |--- |--- |--- |--- |
  |symbol|String|Да|Рынок, на котором был создан ордер.
  |id|String/Number|Да|id ордера.

Пример:

```json
{
    "action": "getOrders",
    "params": [{
        "symbol": "ETH/USDT",
        "id": 1212100295
    }, {
        "symbol": "ETH/USDT",
        "id": "1212074575"
    }]
}
```

Результат:

```json
{  
    "success": true,
    "timestampStart": 1542719586867,
    "timestampEnd": 1542719587697,
    "event": "action",
    "action": "getOrders",
    "data": [  
        {  
            "success": true,
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
        },
        {  
            "success": true,
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

*****

#### cancelOrders

**Описание ниже для всех бирж кроме okex!**

Отмена нескольких ордеров по id.

|Параметр|Тип|Обязательный|Описание|
 |--- |--- |--- |--- |
 |params|Array<String/Number\>|Да|Массив id ордеров.

Пример:

```json
{
    "action": "cancelOrders",
    "params": [
        1212100295,
        "1212074575"
    ]
}
```

Результат:

```json
{  
    "success": true,
    "timestampStart": 1542719952740,
    "timestampEnd": 1542719953566,
    "event": "action",
    "action": "cancelOrders",
    "data": [  
        {  
            "id": 1212100295,
            "success": true
        },
        {  
            "id": "1212074575",
            "success": true
        }
    ]
}
```

*****

#### cancelOrders - Okex

**Описание только для okex!**

Отмена нескольких ордеров.

|Параметр|Тип|Обязательный|Описание|
 |--- |--- |--- |--- |
 |params|Array<Object\>|Да|Параметры ордеров.

Где каждый объект в массвие params содержит:
 
 |Параметр|Тип|Обязательный|Описание|
  |--- |--- |--- |--- |
  |symbol|String|Да|Рынок, на котором был создан ордер.
  |id|String/Number|Да|id ордера.

Пример:

```json
{
    "action": "cancelOrders",
    "params": [{
        "symbol": "ETH/USDT",
        "id": 1212100295
    }, {
        "symbol": "ETH/USDT",
        "id": "1212074575"
    }]
}
```

Результат:

```json
{  
    "success": true,
    "timestampStart": 1542719952740,
    "timestampEnd": 1542719953566,
    "event": "action",
    "action": "cancelOrders",
    "data": [  
        {  
            "id": 1212100295,
            "success": true
        },
        {  
            "id": "1212074575",
            "success": true
        }
    ]
}
```
