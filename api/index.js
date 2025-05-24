const serverless = require('serverless-http');
const app = require('../server'); // Path to your Express app

module.exports.handler = serverless(app); 