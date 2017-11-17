"use strict";
var express = require("express");
var url = require("url");
var bodyParser = require('body-parser');
var randomstring = require("randomstring");
var cons = require('consolidate');
var querystring = require('querystring');
var __ = require('underscore');
__.string = require('underscore.string');
var base64url = require('base64url');
var jose = require('jsrsasign');
var session = require('express-session');


var app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true })); // support form-encoded bodies (for the token endpoint)

app.engine('html', cons.underscore);
app.set('view engine', 'html');

const serverName = 'micronets';

app.set('views', 'files/authorizationServer');
app.set('json spaces', 4);

// authorization server information
const authServer = require('./config.js').servers[serverName].auth;
const resourceServer = require('./config.js').servers[serverName].resource;

// client information
const clients = require('./config.js').clients;



const Datastore = require('nedb-promises');
var db = {};

db.users = new Datastore({filename: serverName+'-users.nedb', autoload: true});
db.users.ensureIndex({fieldName: 'name', unique: true});
db.tokens = new Datastore({filename: serverName+'-tokens.nedb', autoload: true});

var codes = {};

var requests = {};

var getClient = function(clientId) {
	return __.find(clients, function(client) { return client.client_id == clientId; });
};

/****************************************
** This belongs in config.js somewhere **
****************************************/
var protectedResources = [
	{
		"resource_id": "protected-resource-1",
		"resource_secret": "protected-resource-secret-1"
	}
];

var getProtectedResource = function(resourceId) {
	return __.find(protectedResources, function(protectedResource) { return protectedResource.resource_id == resourceId; });
};

/*var getUser = function(username) {
	return userInfo[username];
};*/

function checkAuth (req, res, next) {
	var urlPath = url.parse(req.url).pathname
	//console.log('checkAuth ' + req.url);

	// don't serve /secure to those not logged in
	// you should add to this list, for each and every secure url
	if (urlPath === '/authorize' && (!req.session || !req.session.authenticated)) {
		var queryParms = querystring.stringify(req.query);
		res.redirect('/login?'+queryParms);
		return;
	}

	next();
}

//app.use(cookieParser());
const sessionCookie = authServer.ipAddr.port+'.connect.sid';
app.use(session({ secret: 'example', name: sessionCookie, cookie: {maxAge: 2000}}));
app.use(checkAuth);

app.get('/', function(req, res) {
	res.render('index', {clients: clients, authServer: authServer});
});

var pendingLogins = {}; // idora



function getAccessToken(req, res, next) {
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

	db.tokens.findOne({access_token: inToken})
		.then((token) => {
			if(token) {
				if(token.expires_at < new Date().getTime()) {
					res.status(401).end();
					db.tokens.remove({access_token: token.access_token, client_id: token.client_id}, {})
						.then((num) => {
							console.log('/getAccessToekn(): %d access tokens removed', num);
					}).catch((e) => {
						console.log('/getAccessToekn(): error: %s', e);
					});
					return;
				}
				req.access_token = token;
				console.log('getAccessToken: %s', JSON.stringify(token));
				next();
				return;
			} else {
				res.status(401).end();
			}
		})
		.catch(() => {
			res.status(500).end();
			return;
		})
}

app.post('/idoraxhr', function (req, res) {
	pendingLogins[req.body.sessionId]['req'] = req;
	pendingLogins[req.body.sessionId]['res'] = res;
});

// Remote login route for idora server

app.post('/authsession', getAccessToken, function (req, res) {
	var status = 204; //presume success
	if (req.access_token) {
		//console.log('/authsession - access_token: %s', JSON.stringify(req.access_token));

		if(req.body.sessionId && pendingLogins[req.body.sessionId]) {
			console.log('/authsession - sessionId: %s',req.body.sessionId);

			const pendingLogin = pendingLogins[req.body.sessionId];
			pendingLogin.req.session.authenticated=true;
			pendingLogin.req.session.user = req.body.username;

/*			const redirectUrl = '/authorize?' + querystring.stringify({
				client_id: pendingLogin.parms.client_id,
				redirect_uri: pendingLogin.parms.redirect_uri,
				response_type: pendingLogin.parms.response_type,
				scope: pendingLogin.parms.scope,
				state: pendingLogin.parms.state
			})*/

			var query = pendingLogin.parms;
			var client = getClient(query.client_id);
			var cscope = client.scope ? client.scope.split(' ') : undefined;
			var code = randomstring.generate(8);
			var user = {username: req.access_token.username, sub: req.access_token.sub};

			// save the code and request for later	
			codes[code] = { request: query, scope: cscope, user: user };
		
			var urlParsed = buildUrl(query.redirect_uri, {
				code: code,
				state: query.state
			});

			pendingLogin.res.send(urlParsed).end();
			delete pendingLogins[req.body.sessionId];
		} else {
			status = 410;
		}
	} else {
		status = 401;
	}

	res.status(status).end();
});

app.get("/login", (req, res) => {
	const authorizeQs = {
		client_id: req.query.client_id,
		redirect_uri: req.query.redirect_uri,
		response_type: req.query.response_type,
		scope: req.query.scope,
		state: req.query.state,
	};
	
	//idora
	const sessionId = randomstring.generate(8);
	//console.log('login: sessionId ' + sessionId);
	pendingLogins[sessionId] = {parms: authorizeQs};

	var QRCode = require('qrcode');
	var qrcData = {sessionId: sessionId, domain: serverName};
	QRCode.toDataURL(JSON.stringify(qrcData), function (err, url) {
	  const loginArgs = Object.assign(authorizeQs, {serverName: serverName, sessionId: sessionId, qrcode: url, path: '/idoraxhr'});
		res.render('login2', loginArgs); 	//idora sessionId
	});
});	

function authenticateUser(username, password) {
	const userInfo = require('./config.js').users;
	return new Promise((resolve, reject) => {
		if(userInfo[username] && password === userInfo[username].password) {
			resolve(userInfo[username].sub);
		} else {
			reject('unknown username or password');
		}
	});
}

var userLoginToken = {}; //temporary storage for a token generated in authenticaterUser
app.post('/login', function (req, res, next) {

	if (!req.body.username || !req.body.password) {
		console.log('POST /login error: %s', 'missing authentication info');
		res.redirect('/login');			
	} else {

		authenticateUser(req.body.username, req.body.password)
		.then((loginToken) => {
			req.session.authenticated = true;
			req.session.user = req.body.username;
			userLoginToken[req.body.username] = loginToken;
			res.redirect('/authorize?' + querystring.stringify({
				client_id: req.body.client_id,
				redirect_uri: req.body.redirect_uri,
				response_type: req.body.response_type,
				scope: req.body.scope,
				state: req.body.state
			}));
		}).catch((e) => {
			console.log('authenticateUser error: %s', e);
			res.redirect('/login');
		});

	}
});

app.get("/authorize", function(req, res){
	
	var client = getClient(req.query.client_id);
	
	if (!client) {
		console.log('Unknown client %s', req.query.client_id);
		res.render('error', {error: 'Unknown client'});
		return;
	} else if (!__.contains(client.redirect_uris, req.query.redirect_uri)) {
		console.log('Mismatched redirect URI, expected %s got %s', client.redirect_uris, req.query.redirect_uri);
		res.render('error', {error: 'Invalid redirect URI'});
		return;
	} else {
		
		var rscope = req.query.scope ? req.query.scope.split(' ') : undefined;
		var cscope = client.scope ? client.scope.split(' ') : undefined;
		if (__.difference(rscope, cscope).length > 0) {
			var urlParsed = buildUrl(req.query.redirect_uri, {
				error: 'invalid_scope'
			});
			res.redirect(urlParsed);
			return;
		}
		
		var reqid = randomstring.generate(8);
		
		requests[reqid] = req.query;
		
		console.log(JSON.stringify({serverName: serverName, client: client.client_id, reqid: reqid, scope: rscope}));
		res.render('approveuser', {serverName: serverName, client: client.client_id, reqid: reqid, scope: rscope});
		return;
	}

});

app.get("/loginapprove", function(req, res){
	
	var client = getClient(req.query.client_id);
	
	if (!client) {
		console.log('Unknown client %s', req.query.client_id);
		res.render('error', {error: 'Unknown client'});
		return;
	} else if (!__.contains(client.redirect_uris, req.query.redirect_uri)) {
		console.log('Mismatched redirect URI, expected %s got %s', client.redirect_uris, req.query.redirect_uri);
		res.render('error', {error: 'Invalid redirect URI'});
		return;
	} else {
		
		var cscope = client.scope ? client.scope.split(' ') : undefined;
		/*var rscope = req.query.scope ? req.query.scope.split(' ') : undefined;
		if (__.difference(rscope, cscope).length > 0) {
			var urlParsed = buildUrl(req.query.redirect_uri, {
				error: 'invalid_scope'
			});
			res.redirect(urlParsed);
			return;
		}*/
		
		var reqid = randomstring.generate(8);
		requests[reqid] = req.query;

		//idora
		if(req.query.client_id != 'idora') {
			const sessionId = randomstring.generate(8);
			pendingLogins[sessionId] = {parms: req.query};

			var QRCode = require('qrcode');
			var qrcData = {sessionId: sessionId, domain: serverName};
			QRCode.toDataURL(JSON.stringify(qrcData), function (err, url) {
			  const loginArgs = Object.assign({serverName: serverName, sessionId: sessionId, qrcode: url, path: '/idoraxhr'});
				res.render('loginapprove', {serverName: serverName, client: client.client_id, reqid: reqid, scope: cscope
					,sessionId: sessionId, qrcode: url, path: '/idoraxhr'}); 	//idora sessionId
			});
		} else {
			//console.log(JSON.stringify({serverName: serverName, client: client.client_id, reqid: reqid, scope: cscope}));
			res.render('loginapprove', {serverName: serverName, client: client.client_id, reqid: reqid, scope: cscope
				,sessionId: null, qrcode: null, path: null});
			return;
		}
	}
});

app.post('/loginapprove', function(req, res) {

	var query = requests[req.body.reqid];

	if (!query) {
		return;
	}
	
	if (req.body.approve) {
		if (query.response_type == 'code') {
			// user approved access

			var client = getClient(query.client_id);
			var cscope = client.scope ? client.scope.split(' ') : undefined;

			//use to have user selected scopes
			/*var rscope = getScopesFromForm(req.body);
			if (__.difference(rscope, cscope).length > 0) {
				res.redirect(buildUrl(query.redirect_uri, {
					error: 'invalid_scope',
					state: query.state
				}));
				return;
			}*/

			var code = randomstring.generate(8);

			if (!req.body.username || !req.body.password) {
				res.redirect(buildUrl(query.redirect_uri, {
					error: 'missing authentication info',
					state: query.state
				}));
				return;	
			} else {
				authenticateUser(req.body.username, req.body.password)
				.then((loginToken) => {
					var user = {username: req.body.username, sub: loginToken};
					
					// save the code and request for later					
					codes[code] = { request: query, scope: cscope, user: user };
				
					res.redirect(buildUrl(query.redirect_uri, {
						code: code,
						state: query.state
					}));
					return;
				}).catch((e) => {
					res.redirect(buildUrl(query.redirect_uri, {
						error: 'invalid user authentication information',
						state: query.state
					}))
				});
			}
		} else {
			// we got a response type we don't understand

			res.redirect(buildUrl(query.redirect_uri, {
				error: 'unsupported_response_type',
				state: query.state
			}));
			return;
		}
	} else {
		// user denied access

		res.redirect(buildUrl(query.redirect_uri, {
			error: 'access_denied',
			state: query.state
		}));
		return;
	}
});

app.post('/approve', function(req, res) {

	var reqid = req.body.reqid;
	var query = requests[reqid];
	delete requests[reqid];

	if (!query) {
		// there was no matching saved request, this is an error
		res.render('error', {error: 'No matching authorization request'});
		return;
	}
	
	if (req.body.approve) {
		if (query.response_type == 'code') {
			// user approved access

			var rscope = getScopesFromForm(req.body);
			var client = getClient(query.client_id);
			var cscope = client.scope ? client.scope.split(' ') : undefined;
			if (__.difference(rscope, cscope).length > 0) {
				var urlParsed = buildUrl(query.redirect_uri, {
					error: 'invalid_scope'
				});
				res.redirect(urlParsed);
				return;
			}

			var code = randomstring.generate(8);
			
			var user = {username: req.session.user, sub: userLoginToken[req.session.user]};
			delete userLoginToken[req.session.user];
			/*var user = getUser(req.session.user);
			console.log("POST /approve user = " + user);*/
			
			// save the code and request for later
			
			codes[code] = { request: query, scope: rscope, user: user };
		
			var urlParsed = buildUrl(query.redirect_uri, {
				code: code,
				state: query.state
			});
			res.redirect(urlParsed);
			return;
		} else {
			// we got a response type we don't understand
			var urlParsed = buildUrl(query.redirect_uri, {
				error: 'unsupported_response_type'
			});
			res.redirect(urlParsed);
			return;
		}
	} else {
		// user denied access
		var urlParsed = buildUrl(query.redirect_uri, {
			error: 'access_denied'
		});
		res.redirect(urlParsed);
		return;
	}
	
});

app.post("/token", function(req, res){
	
	var auth = req.headers['authorization'];
	if (auth) {
		// check the auth header
		var clientCredentials = decodeClientCredentials(auth);
		var clientId = clientCredentials.id;
		var clientSecret = clientCredentials.secret;
	}
	
	// otherwise, check the post body
	if (req.body.client_id) {
		if (clientId) {
			// if we've already seen the client's credentials in the authorization header, this is an error
			console.log('Client attempted to authenticate with multiple methods');
			res.status(401).json({error: 'invalid_client'});
			return;
		}
		
		var clientId = req.body.client_id;
		var clientSecret = req.body.client_secret;
	}
	
	var client = getClient(clientId);
	if (!client) {
		console.log('Unknown client %s', clientId);
		res.status(401).json({error: 'invalid_client'});
		return;
	}
	
	if (client.client_secret != clientSecret) {
		console.log('Mismatched client secret, expected %s got %s', client.client_secret, clientSecret);
		res.status(401).json({error: 'invalid_client'});
		return;
	}
	
	if (req.body.grant_type == 'authorization_code') {
		
		var code = codes[req.body.code];
		
		if (code) {
			delete codes[req.body.code]; // burn our code, it's been used
			if (code.request.client_id == clientId) {

				var access_token = randomstring.generate();
				const expires_in = 60*60*24; //24 hours
				var token_response = {};
				db.tokens.insert({access_token: access_token, expires_at: new Date().getTime()+1000*expires_in,
											client_id: clientId, scope: code.scope, 
											username: code.user.username, sub: code.user.sub})
					.then((access_token) => {
						token_response.access_token = access_token.access_token;
						token_response.token_type = 'Bearer';
						token_response.expires_in = expires_in;
						token_response.scope = code.scope.join(' ');

						if(client.refreshToken) {
							var refresh_token = randomstring.generate();
							return db.tokens.insert({refresh_token: refresh_token, client_id: clientId,
									scope: code.scope, username: code.user.username, sub: code.user.sub})
						} else {
							return null;
						}	
					})
					.then((refresh_token) => {
						if(refresh_token) {
							token_response.refresh_token = refresh_token.refresh_token;
						}
						res.status(200).json(token_response);
						console.log('POST /token: %s', JSON.stringify(token_response));
						return;
					})
					.catch((e) => {
						console.log('/token error: %s', e);
						res.status(500).json({});
					});
			} else {
				console.log('Client mismatch, expected %s got %s', code.request.client_id, clientId);
				res.status(400).json({error: 'invalid_grant'});
				return;
			}
		} else {
			console.log('Unknown code, %s', req.body.code);
			res.status(400).json({error: 'invalid_grant'});
			return;
		}
	} else if (req.body.grant_type == 'refresh_token') {
		db.tokens.findOne({refresh_token: req.body.refresh_token})
			.then((refresh_token) => {
				if (refresh_token.client_id == clientId) {
					var access_token = randomstring.generate();
					const expires_in = 60*60*24; //24 hours

					var promises = [Promise.resolve(
						{ access_token: access_token, token_type: 'Bearer',  refresh_token: refresh_token.refresh_token }
					)];

					promises[1] = db.tokens.insert({ access_token: access_token, expires_at: new Date().getTime()+1000*expires_in,
						client_id: clientId, scope: refresh_token.scope, username: refresh_token.username, sub: refresh_token.sub });

					return Promise.all(promises);
				} else {
					return Promise.reject("refresh token client id mismatch");
				}
			})
			.then((promiseResults) => {
				console.log('\n\nRefresh_token\nIssuing access token: %s\n%s\n\n', clientId,
					JSON.stringify(promiseResults[0]));

				res.status(200).json(promiseResults[0]);
				return;
			})
			.catch((e) => {
				console.log('token_refresh error: %s', e);
				res.status(400).json({error: e});
				return;
			});
	} else {
		console.log('Unknown grant type %s', req.body.grant_type);
		res.status(400).json({error: 'unsupported_grant_type'});
	}
});

app.post('/introspect', function(req, res) {
	var auth = req.headers['authorization'];
	var resource = getProtectedResource(decodeClientCredentials(auth).id);
 	if(!resource || resource.resource_secret != decodeClientCredentials(auth).secret) {
		res.status(401).end();
		return;
	} 

	var inToken = req.body.token;
	db.tokens.findOne({access_token: inToken})
		.then((token) => {
			if(token.expires_at < new Date().getTime()) {
				res.status(200).json({active: false});
				db.tokens.remove({access_token: token, client_id: token.client_id}, {})
					.then((num) => {
						console.log('POST /introspect: %d access tokens removed', num);
				}).catch((e) => {
					console.log('POST /introspect: error: %s', e);
				});
			}
			var introspectionResponse = {
				active: true,
		    iss: authServer.ipAddr.host + ':' + authServer.ipAddr.port,
		    aud: resourceServer.ipAddr.host + ':' + resourceServer.ipAddr.port,
		    sub: token.sub ? token.sub : undefined,
		    username: token.username ? token.username : undefined,
		    scope: token.scope ? token.scope.join(' ') : undefined,
		    client_id: token.client_id
			}

			var client = getClient(token.client_id);
			if(client.onetimeToken) {
				db.tokens.remove({access_token: inToken, client_id: token.client_id}, {})
					.then((num) => {
						console.log('POST /introspect: %d access tokens removed', num);
				}).catch((e) => {
					console.log('POST /introspect: error: %s', e);
				});				
			}
			res.status(200).json(introspectionResponse);
			return;
	}).catch(() => {
		res.status(200).json({active: false});
		return
	});
});

app.post('/userpass', function(req, res) {
	if (req.body.username && req.body.password
			&& userInfo[req.body.username] && req.body.password === userInfo[req.body.username].password) {
		res.status(200).send();
	} else {
		res.status(403).send();
	}
	res.end();
	return
});

app.post('/revoke', function(req, res) {
	var auth = req.headers['authorization'];
	if(auth) {
		var clientId = decodeClientCredentials(auth).id;
		var clientSecret = decodeClientCredentials(auth).secret;
	}

	if(req.body.client_id) {
		if(clientId) {
			res.status(401).json({error: "attempted to authenticate with multiple methods"});
			return;
		}

		var clientId = req.body.client_id;
		var clientSecret = req.body.client_secret;
	}

	var client  = getClient(clientId);
	if(!client || client.client_secret != clientSecret) {
		res.status(401).json({error: 'invalid client'});
		return;
	}

	var access_token = req.body.access_token ? req.body.access_token : "";
	var refresh_token = req.body.refresh_token ? req.body.refresh_token : "";

	db.tokens.remove({access_token: access_token, client_id: clientId }, {})
		.then((num) => {
			console.log('/revoke: %d access tokens removed', num);
			return db.tokens.remove({refresh_token: refresh_token, client_id: clientId }, {});
		})
		.then((num) => {
			console.log('/revoke: %d refresh tokens removed', num);
			res.status(204).end();
		})
		.catch((e) => {
			console.log('/revoke: error: %s', e);
			res.status(500).end();
			return;
		});
});

var buildUrl = function(base, options, hash) {
	var newUrl = url.parse(base, true);
	delete newUrl.search;
	if (!newUrl.query) {
		newUrl.query = {};
	}
	__.each(options, function(value, key, list) {
		newUrl.query[key] = value;
	});
	if (hash) {
		newUrl.hash = hash;
	}
	
	return url.format(newUrl);
};

var decodeClientCredentials = function(auth) {
	var clientCredentials = new Buffer(auth.slice('basic '.length), 'base64').toString().split(':');
	var clientId = querystring.unescape(clientCredentials[0]);
	var clientSecret = querystring.unescape(clientCredentials[1]);	
	return { id: clientId, secret: clientSecret };
};

var getScopesFromForm = function(body) {
	return __.filter(__.keys(body), function(s) { return __.string.startsWith(s, 'scope_'); })
				.map(function(s) { return s.slice('scope_'.length); });
};

app.use('/', express.static('files/authorizationServer'));


var server = app.listen(authServer.ipAddr.port, authServer.ipAddr.host , function () {
  var host = server.address().address;
  var port = server.address().port;

  console.log(serverName + ' OAuth Authorization Server is listening at http://%s:%s', host, port);
});
 
