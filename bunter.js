const path = require('path')
const express = require('express')
const exphbs = require('express-handlebars')
let config = require('./config')
const app = express()

app.engine('.hbs', exphbs({
    defaultLayout: null,
    extname: '.hbs',
    layoutsDir: path.join(__dirname, 'views/layouts')
}))
app.set('view engine', '.hbs')
app.set('views', path.join(__dirname, 'views'))

app.use('/public', express.static(path.join(__dirname, 'public')))


app.get('/', (request, response) => {
    response.render('bunter', {
        port: config.port,
        socketPort: config.socketPort,
        svIP: config.svIP
    })
})

app.listen(config.port, (err) => {
    if (err) {
        return console.log('something bad happened', err)
    }

    console.log(`server is listening on ${config.port}`)
})


const api = require('binance');
const binanceRest = new api.BinanceRest({
    key: config.apiKey,
    secret: config.secretKey,
    timeout: 15000,
    recvWindow: 10000,
    disableBeautification: false,
    handleDrift: false
});

var binanceWS = new api.BinanceWS(true); // Argument specifies whether the responses should be beautified, defaults to true

var authed = false
var io = require('socket.io')();
var aggTradesListenners = {}
io.on('connection', function (client) {
    client.emit('msg', {msg: 'welcome to BUNT3R helper service'});


    client.on('grantAccess', function (data) {
        if (data.username && data.password) {
            if (data.username == config.username && data.password == config.password) {
                authed = true
                client.emit('grant', true)
            } else {
                client.emit('grant', false)

            }
        }
        else
            client.emit('grant', false)

    })


    client.on('aggTrades', function (data) {
        if (authed == false)
            return false
        if (!aggTradesListenners[data.symbol]) {
            binanceWS.onAggTrade(data.symbol, (datas) => {
                client.emit('aggTrades', datas)
            })

            binanceRest.depth({
                symbol: data.symbol,
                limit: 50
            })
                .then((book) => {
                    book.symbol = data.symbol
                    client.emit('depth', book)

                    binanceWS.onDepthUpdate(data.symbol, (depth) => {
                        client.emit('depthUpdate', depth)

                    })


                })
                .catch((err) => {
                    console.error(err);
                });

            aggTradesListenners[data.symbol] = true
        }
    })


    client.on('disconnect', function (client) {

        aggTradesListenners = {}
        process.exit()
    })

});


io.listen(config.socketPort);
console.log(`Socket service port : ${config.socketPort}`)





