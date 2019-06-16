'use strict';

const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');
const config = require('./config');

module.exports = function populateEnvironment () {
  const environment = (process.env.NODE_ENV || 'development');
  const files = [
    '.env.defaults',
    '.env',
    '.env.local',
    `.env.${environment}`,
    `.env.${environment}.local`
  ];

  for (let file of files) {
    let fullname = path.join(__dirname, '..', file);
    if (fs.existsSync(fullname)) {
      const options = dotenv.parse(fs.readFileSync(fullname));
      for (let key in options) {
        if (key in config) {
          process.env[key] = options[key];
          config[key] = options[key];
        }
      }
    }
  }
};
