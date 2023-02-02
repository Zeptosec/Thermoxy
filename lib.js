var httpProxy = require('http-proxy');
var net = require('net');
var url = require('url');

function withCORS(headers, request) {
    headers['access-control-allow-origin'] = '*';
    if (request.headers['access-control-request-method']) {
        headers['access-control-allow-methods'] = request.headers['access-control-request-method'];
        delete request.headers['access-control-request-method'];
    }
    if (request.headers['access-control-request-headers']) {
        headers['access-control-allow-headers'] = request.headers['access-control-request-headers'];
        delete request.headers['access-control-request-headers'];
    }

    headers['access-control-expose-headers'] = Object.keys(headers).join(',');

    return headers;
}

function proxyRequest(req, res, proxy) {
    var location = req.theState.location;
    req.url = location;
    var proxyOptions = {
        changeOrigin: false,
        prependPath: false,
        target: location,
        headers: {
            host: 'cdn.discordapp.com',
        },
        buffer: {
            pipe: function (proxyReq) {
                var proxyReqOn = proxyReq.on;
                proxyReq.on = function (eventName, listener) {
                    if (eventName !== 'response') {
                        return proxyReqOn.call(this, eventName, listener);
                    }
                    return proxyReqOn.call(this, 'response', function (proxyRes) {
                        if (onProxyResponse(proxyRes, req)) {
                            try {
                                listener(proxyRes);
                            } catch (err) {
                                proxyReq.emit('error', err);
                            }
                        }
                    });
                };
                return req.pipe(proxyReq);
            },
        },
    };

    try {
        proxy.web(req, res, proxyOptions);
    } catch (err) {
        proxy.emit('error', err, req, res);
    }
}

function onProxyResponse(proxyRes, req) {
    delete proxyRes.headers['set-cookie'];
    delete proxyRes.headers['set-cookie2'];

    withCORS(proxyRes.headers, req);
    return true;
}

function getHandler(proxy) {
    var corsAnywhere = {
        removeHeaders: [
            'cookie',
            'cookie2',
            'x-request-start',
            'x-request-id',
            'via',
            'connect-time',
            'total-route-time']
    };

    return function (req, res) {
        req.theState = {
        };
        const mainUrl = req.url.slice(1);
        var cors_headers = withCORS({}, req);
        if (req.method === 'OPTIONS') {
            // Pre-flight request. Reply successfully:
            res.writeHead(200, cors_headers);
            res.end();
            return;
        }
        if (mainUrl.length !== 19) {
            res.writeHead(400, 'Input must be 19 chars in length', cors_headers);
            res.end('Input not long enough 19 chars required.');
            return;
        }
        var location = `https://cdn.discordapp.com/attachments/1025526944776867952/${mainUrl}/blob`;

        corsAnywhere.removeHeaders.forEach(function (header) {
            delete req.headers[header];
        });

        req.theState.location = location;

        proxyRequest(req, res, proxy);
    };
}

exports.createServer = function createServer(options) {

    var proxy = httpProxy.createServer();
    var requestHandler = getHandler(proxy);
    var server = require('http').createServer(requestHandler);

    proxy.on('error', function (err, req, res) {
        if (res.headersSent) {
            if (res.writableEnded === false) {
                res.end();
            }
            return;
        }

        var headerNames = res.getHeaderNames ? res.getHeaderNames() : Object.keys(res._headers || {});
        headerNames.forEach(function (name) {
            res.removeHeader(name);
        });
        console.log(err);
        res.writeHead(404, { 'Access-Control-Allow-Origin': '*' });
        res.end('Not found because of: ' + err);
    });

    return server;
};
