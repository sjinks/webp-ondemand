const net = require('net');

const config = {};

const props = {
  PORT: 7777,
  LISTEN_HOST: '127.0.0.1',
  CONTENT_NEGOTIATION: true,
  MAX_AGE: 864000,
  ACH_LIFETIME: 864000,
  HOSTMAP: {}
};

Object.defineProperty(config, 'PORT', {
  enumerable: true,
  get: function () {
    return props.PORT;
  },
  set: function (value) {
    value = parseInt(value, 10);
    if (!isNaN(value) && value > 0 && value <= 65535) {
      props.PORT = value;
    }
  }
});

Object.defineProperty(config, 'LISTEN_HOST', {
  enumerable: true,
  get: function () {
    return props.LISTEN_HOST;
  },
  set: function (value) {
    if (net.isIP(value)) {
      props.LISTEN_HOST = value;
    }
  }
});

Object.defineProperty(config, 'CONTENT_NEGOTIATION', {
  enumerable: true,
  get: function () {
    return props.CONTENT_NEGOTIATION;
  },
  set: function (value) {
    props.CONTENT_NEGOTIATION = !!parseInt(value, 10);
  }
});

Object.defineProperty(config, 'MAX_AGE', {
  enumerable: true,
  get: function () {
    return props.MAX_AGE;
  },
  set: function (value) {
    value = parseInt(value, 10);
    if (value >= 0) {
      props.MAX_AGE = value;
    }
  }
});

Object.defineProperty(config, 'ACH_LIFETIME', {
  enumerable: true,
  get: function () {
    return props.ACH_LIFETIME;
  },
  set: function (value) {
    value = parseInt(value, 10);
    if (value >= 0) {
      props.ACH_LIFETIME = value;
    }
  }
});

Object.defineProperty(config, 'HOSTMAP', {
  enumerable: true,
  get: function () {
    return props.HOSTMAP;
  },
  set: function (value) {
    value += '';
    let map = {};
    value.split(';').filter(Boolean).forEach(item => {
      const parts = item.split(':', 2);
      if (typeof parts[1] !== 'undefined') {
        map[parts[0].toLowerCase()] = parts[1];
      }
    });

    props.HOSTMAP = map;
  }
});

module.exports = config;
