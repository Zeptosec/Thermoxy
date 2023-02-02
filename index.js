var cors_proxy = require('./lib');
cors_proxy.createServer({
  removeHeaders: [
    'cookie',
    'cookie2',
    'x-request-start',
    'x-request-id',
    'via',
    'connect-time',
    'total-route-time'
  ],
  redirectSameOrigin: true
}).listen(process.env.PORT || 8080, function() {
  console.log('server running on port ' + (process.env.PORT || 8080));
});
