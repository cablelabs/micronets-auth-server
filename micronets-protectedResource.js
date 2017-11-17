"use strict";

var express = require("express");
var bodyParser = require('body-parser');
var cons = require('consolidate');
var qs = require("qs");
var querystring = require('querystring');
var request = require("sync-request");
var __ = require('underscore');
var cors = require('cors');

var app = express();

app.use(bodyParser.urlencoded({ extended: true })); // support form-encoded bodies (for bearer tokens)

app.engine('html', cons.underscore);
app.set('view engine', 'html');

const serverName = 'micronets';
app.set('views', 'files/protectedResource');
app.set('json spaces', 4);

app.use('/', express.static('files/protectedResource'));
app.use(cors());

var protectedResources = {
		"resource_id": "protected-resource-1",
		"resource_secret": "protected-resource-secret-1"
};

const serverInfo = require('./config.js').servers[serverName];
var authServer = serverInfo.auth;


var getAccessToken = function(req, res, next) {
	// check the auth header first
	var auth = req.headers['authorization'];
	var inToken = null;
	if (auth && auth.toLowerCase().indexOf('bearer') == 0) {
		inToken = auth.slice('bearer '.length);
	} else if (req.body && req.body.access_token) {
		// not in the header, check in the form body
		inToken = req.body.access_token;
	} else if (req.query && req.query.access_token) {
		inToken = req.query.access_token
	}
	
	console.log('Incoming token: %s', inToken);

	/*
	 * Send the incoming token to the introspection endpoint and parse the results
	 */

	var form_data = qs.stringify({token: inToken});
	var headers = {
		"Content-Type": "application/x-www-form-urlencoded",
		"Authorization": "Basic "
			+ encodeClientCredentials(protectedResources.resource_id, protectedResources.resource_secret)
	};

	console.log('POST: %s, %s', authServer.introspectionEndpoint, JSON.stringify({
		body: form_data,
		headers: headers
	}));

	var tokRes = request('POST', authServer.introspectionEndpoint, {
		body: form_data,
		headers: headers
	});

	if(tokRes.statusCode >= 200 && tokRes.statusCode < 300) {
		var body = JSON.parse(tokRes.getBody());
		console.log("Introspection response: ", body);
		if(body.active) {
			req.access_token = body;
		}
	}

	next();
	return;
};

var requireAccessToken = function(req, res, next) {
	if (req.access_token) {
		next();
	} else {
		res.status(401).end();
	}
};


app.options('/resource', cors());


function getResource(username, userToken, scope) {

	var resource = {
		name:					serverName + ' Protected Resource',
		description:	'Device credentials',
		userToken:		userToken,
		username:			username,
		scope:				scope
	};

	return Promise.resolve(resource);
}

app.post("/resource", cors(), getAccessToken, function(req, res){

	if (req.access_token) {
		console.log('POST /resource. For user: %s, user token: %s, token scope: %s, device id: %s, device blob: %s',
			req.access_token.username, req.access_token.sub, req.access_token.scope.split(' '), req.body.deviceId,
			req.body.deviceBlob);
		getResource(req.access_token.username, req.access_token.sub, req.access_token.scope.split(' '))
		.then((response) => {
			res.json(response);
		}).catch((error) => {
			res.status(500).end();
		});

	} else {
		res.status(401).end();
	}
});

var encodeClientCredentials = function(clientId, clientSecret) {
	return new Buffer(querystring.escape(clientId) + ':' + querystring.escape(clientSecret)).toString('base64');
};

var server = app.listen(serverInfo.resource.ipAddr.port, serverInfo.resource.ipAddr.host, function () {
  var host = server.address().address;
  var port = server.address().port;

  console.log('OAuth Resource Server is listening at http://%s:%s', host, port);
});
 
