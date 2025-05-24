const serverless = require('serverless-http');
const app = require('../server.js');   // your Express app

module.exports.handler = serverless(app); 