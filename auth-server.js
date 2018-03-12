"use strict";

/* auth-server - derived from Bob Lund's prototype: ssh://git@code.cablelabs.com:7999/IdOra/AuthResourceEndpoints.git 
   - Refactored/streamlined to specifically support micronets use case instead of general use case of using oauth tokens for accessing protected resources.
   - Modularized to make more maintainable, moved endpoint handlers into routes.
   - Use async/await instead of promise syntax (Still uses promise compliant functions)
*/

// Installed modules
const express = require("express");
const app = express();
const bodyParser = require('body-parser');
const cons = require('consolidate');
const session = require('express-session');
const path = require('path');
var logger = require('morgan');

// Log level
app.use(logger('dev'));

var env = process.env;

//Object.keys(env).forEach(function(key) {
//  console.log('export ' + key + '="' + env[key] +'"');
//});

console.log("env PORT: "+process.env.PORT);

// Local modules
const config = require('./lib/config.js');

// Mount folder for resources (css, js, images)
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true })); // support form-encoded bodies (for the token endpoint)

// Template engine
app.engine('html', cons.underscore);
app.set('view engine', 'html');
app.set('views', path.join(__dirname, 'views'));
app.set('json spaces', 4);

// Sessions
const sessionCookie = config.server.port+'.connect.sid';
app.use(session({ secret: 'secblanket', resave: true, saveUninitialized: true, name: sessionCookie, cookie: {maxAge: 2000}}));

// Routes
app.use('/', require('./routes/index'));
app.use('/oauth2', require('./routes/oauth2'));

// Last chance exception handler
process.on('unhandledException', error => {
	console.log('unhandledException: ', error);
	var stack = new Error().stack;
	console.log(stack);
});

// Start Server
var server = app.listen(process.env.PORT || config.server.port, function () {
	var host = server.address().address;
	var port = server.address().port;
	console.log('Micronets Authorization Server is listening on port %s', port);
});
