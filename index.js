'use strict';

const http = require('http');
const config = require('./lib/config');
const populateEnv = require('./lib/environment');
const handler = require('./lib/handler');

populateEnv();

const server = http.createServer(handler);
server.listen(parseInt(config.PORT, 10) || 7777, config.LISTEN_HOST, (err) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
});

server.on('listening', function () {
  'send' in process && process.send('ready');
});

process.on('SIGHUP', function () {
  const old = Object.assign({}, config);
  populateEnv();
  if (old.PORT != config.PORT || old.LISTEN_HOST !== config.LISTEN_HOST) { // eslint-disable-line eqeqeq
    server.close();
    server.listen(parseInt(config.PORT, 10) || 7777, config.LISTEN_HOST, (err) => {
      if (err) {
        console.error(err);
        process.exit(1);
      }
    });
  }
});

process.on('SIGINT', function () {
  server.close(function (err) {
    if (err) {
      console.error(err);
      process.exit(1);
    }

    process.exit(0);
  });
});
