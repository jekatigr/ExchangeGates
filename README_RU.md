# Exchanges Gates

> Единый javascript и websocket-интерфейс к криптобиржам.


### Поддерживаемые биржи

- Bibox ([bibox.com](https://bibox.com))
- Binance ([binance.com](https://binance.com))
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
exchange| String | да | - | Одно из значений: bibox, binance, bitfinex, huobi, tidex, okex.
apiKey| String |да|-|Api key аккаунта на бирже.
apiSecret| String |да|-|Api secret аккаунта на бирже.
passphrase| String |нет*|-|Passphrase для доступа к okex api (обязательно для okex).
ipArray| Array<String\> |нет|Внешний ip|Массив ip-адресов, с которых будут запрашиваться api бирж.

Пример конфигурационного файла:

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

### Установка и запуск

Для установки:

    yarn --prod
    
Для запуска:

    cross-env CONFIG_FILE_PATH='<путь_к_файлу_конфигурации>' node index.js

Либо один из следующих вариантов:

    yarn run start-bibox
    yarn run start-binance
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

При открытии соединения с сокетом сервер сразу присылает два сообщения: connected и availableActions. После этого сокет ожидает команды от клиента.

#### Идентификатор запроса

В каждую команду к веб-сокету можно добавить поле id с пользовательским идентификатором.
Этот id вернется в ответе на запрос, например:

Запрос:

    { 
        "action": "getMarkets", 
        "id": "myUniqueId" 
    }
    
Ответ:
    
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

### Доступные методы

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

Метод возвращает массив рынков с указанием точности, комиссий и ограничений при выставлении ордеров.

Пример:

```json
{
    "action": "getMarkets"
}
```

<details>
<summary>Результат:</summary>

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

Метод предназначен для запуска подключения к биржам через websocket для получения ордербуков.

Метод необходимо вызвать перед использованием методов **getOrderbooks** и **runOrderbooksNotifier**.

_Для Tidex метод вызывать не требуется._

|Параметр|Тип|Обязательный|По-умолчанию|Описание|
|--- |--- |--- |--- |--- |
|params|Array<String\>|Нет|Все рынки|Рынки, для которых требуется подключение к ws.

Пример:

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
<summary>Результат:</summary>

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

Метод возвращает массив ордербуков.

Перед использованием необходимо вызвать метод **connectToExchange** для 
инициализации соединений с биржей (в случае, если соединения не были установлены ранее).

Рынки, указанные в параметре _symbols_, должны быть включены в параметры 
запуска метода **connectToExchange**, иначе сервер вернет данные только для подключенных ордербуков.

|Параметр|Тип|Обязательный|По-умолчанию|Описание|
|--- |--- |--- |--- |--- |
|symbols|Array<String\>|Нет|Все подключенные рынки|Рынки, для которых требуется получить ордербуки.
|limit|Number|Нет|1|Размер массивов asks и bids в результирующих ордербуках.

Пример:

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
<summary>Результат:</summary>

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

Запуск оповещений. После отправки этой команды в ответ 
начинают отправляться ордербуки. При этом:

- в первом сообщении будут отправлены все доступные ордербуки
- в последующих сообщениях будут присылаться только обновленные ордербуки
 
 Перед использованием необходимо вызвать метод **connectToExchange** для 
 инициализации соединений с биржей (в случае, если соединения не были установлены ранее).
 
 Рынки, указанные в параметре _symbols_, должны быть включены в параметры 
 запуска метода **connectToExchange**, иначе сервер вернет данные только для подключенных ордербуков.
 
 |Параметр|Тип|Обязательный|По-умолчанию|Описание|
 |--- |--- |--- |--- |--- |
 |symbols|Array<String\>|Нет|Все подключенные рынки|Рынки, для которых требуется получать ордербуки.
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

<details>
<summary>Результат:</summary>

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

Остановка оповещений об обновленных ордербуках.

Пример:

```json
{
    "action": "stopOrderbooksNotifier"
}
```

<details>
<summary>Результат:</summary>

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

Метод возвращает балансы кошельков на бирже.

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

<details>
<summary>Результат:</summary>

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

<details>
<summary>Результат:</summary>

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

Метод возвращает массив активных ордеров.

|Параметр|Тип|Обязательный|По-умолчанию|Описание|
 |--- |--- |--- |--- |--- |
 |params|String|Нет*|Все рынки|Рынок, для которого нужно получить активные ордера.

* для Binance указание рынка обязательно!

Пример:

```json
{
    "action": "getActiveOrders",
    "params": "ETH/USDT"
}
```

<details>
<summary>Результат:</summary>

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

Метод возвращает ордер.

|Параметр|Тип|Обязательный|Описание|
 |--- |--- |--- |--- |
 |symbol|String|Да|Рынок.
 |id|String/Number|Да|id ордера.

Пример:

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
<summary>Результат:</summary>

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

Отмена ордера.

|Параметр|Тип|Обязательный|Описание|
 |--- |--- |--- |--- |
 |symbol|String|Да|Рынок.
 |id|String/Number|Да|id ордера.

Пример:

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
<summary>Результат:</summary>

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

**Доступно только для Bitfinex**

Метод возвращает адрес для ввода средств на биржу.

|Параметр|Тип|Обязательный|Описание|
 |--- |--- |--- |--- |
 |params|String|Да|Валюта, для которой нужно получить адрес ввода.

Пример:

```json
{
    "action": "getDepositAddress",
    "params": "BTC"
}
```

<details>
<summary>Результат:</summary>

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

**Доступно только для Bitfinex и Huobi**

Вывод средств с баланса. В ответе возвращает id запроса на вывод средств.

|Параметр|Тип|Обязательный|Описание|
 |--- |--- |--- |--- |
 |currency|String|Да|Валюта
 |address|String|Да|Адрес кошелька
 |amount|Number|Да|Количество
 
Пример:

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
<summary>Результат:</summary>

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

Отключение сервиса.
 
Пример:

```json

{
    "action": "shutdown"
}
```

Для данной команды ответа не предусмотрено.