/* oauth2.js
 * oauth client endpoints. (presuming IdOra for the micronets application)
 */

'use strict';

const express = require('express');
const router = express.Router();
const path = require('path');
const randomstring = require("randomstring");
let __ = require('underscore');
__.string = require('underscore.string');

// Local modules
const db = require('../lib/auth-db.js');
const config = require('../lib/config.js');
const auth = require('../lib/auth.js');

// OAUTH redirect for subscriber to approve application access to account using access token.
router.get("/authorize", function(req, res){
	(async () => {
        try {
			var client = await db.getClient(req.query.client_id);
			if (!__.contains(client.redirect_uris, req.query.redirect_uri)) {
				console.log('Mismatched redirect URI, expected %s got %s', client.redirect_uris, req.query.redirect_uri);
				throw 'Invalid redirect URI';
			} 
			else {
				var cscope = client.scope ? client.scope.split(' ') : undefined;		
				var reqid = randomstring.generate(8);
				db.requests[reqid] = req.query;

				// redirect from idora portal (user is preauthorizing user for future QRCode remote logins)
				res.render('authorize', {client: client.client_id, reqid: reqid, scope: cscope});
			}
        } catch (e) {
        	console.log("/authorize error: "+e);
        	res.render('error', {error: e});
        }    
    })();
});

// User has clicked submit on the login form. If this is from IdOra on behalf of a user, return a code that can later be
// redeemed for an access token.
router.post('/submitauthorize', function(req, res) {

	(async () => {
        try {
        	var query = db.requests[req.body.reqid];

			if (!query) {
				throw "invalid_request";
			}
			else if (!req.body.approve) {
				throw "access_denied";
			}
			else if (query.response_type != 'code') {
				throw "unsupported_response_type";
			}
			else if (!req.body.username || !req.body.password) {
				throw 'missing_authentication_info';
			} 

			let client = await db.getClient(query.client_id);
			var cscope = client.scope ? client.scope.split(' ') : undefined;

			var code = randomstring.generate(8);

			let loginToken = await auth.authenticateUser(req.body.username, req.body.password);
			const user = {username: req.body.username, sub: loginToken};
			
			// save the code and request for later					
			db.codes[code] = { request: query, scope: cscope, user: user };
		
			res.redirect(auth.buildUrl(query.redirect_uri, {
				code: code,
				state: query.state
			}));
			
    	} catch (e) {
			res.redirect(auth.buildUrl(query.redirect_uri, {
				error: e,
				state: query.state
			}));
			return;	
        }    
    })();
});

// Client has presented a code to be exchanged for a token.
router.post("/token", function(req, res) {
	
	let clientId, clientSecret;

	(async () => {
        try {
        	// Authorization
			if (req.headers.authorization) {
				const clientCredentials = auth.decodeClientCredentials(req.headers.authorization);
				clientId = clientCredentials.id;
				clientSecret = clientCredentials.secret;
			}
			else if (req.body.client_id) {
				clientId = req.body.client_id;
				clientSecret = req.body.client_secret;
			}

			// Client
			let client = await db.getClient(clientId);
			if (!client) {
				throw "invalid client";
			}
			else if (client.client_secret != clientSecret) {
				throw "invalid_client_secret";
			}

			// Grant type
			if (req.body.grant_type == 'authorization_code') {
		
				var code = db.codes[req.body.code];
				if (!code) {
					console.log("unknown grant code");
					throw "invalid_grant";
				}

				delete db.codes[req.body.code]; // burn our code, it's been used

				if (code.request.client_id != clientId) {
					console.log("client mismatch");
					throw "invalid_grant";
				}
				const expires_in = 60*60*24; //24 hours
				const token = {
					access_token: randomstring.generate(), 
					expires_at: new Date().getTime()+1000*expires_in,
					client_id: clientId, 
					scope: code.scope, 
					username: code.user.username, 
					sub: code.user.sub
				};

				let access_token = await db.tokens.insert(token);
					
				let token_response = {
					access_token: access_token.access_token,
					token_type: 'Bearer',
					expires_in: expires_in,
					scope: code.scope.join(' ')
				};

				if (client.refreshToken) {
					const refresh_token = {
						refresh_token: randomstring.generate(), 
						client_id: clientId,
						scope: code.scope,
						username: code.user.username, 
						sub: code.user.sub
					};

					await db.tokens.insert(refresh_token);
					token_response.refresh_token = refresh_token.refresh_token;
				}

				res.status(200).json(token_response);
				console.log('POST /token: %s', JSON.stringify(token_response));
				return;
			}
			else if (req.body.grant_type == 'refresh_token') {

				let refresh_token = await db.tokens.findOne({refresh_token: req.body.refresh_token});
				if (!refresh_token) {
					console.log('Refresh token not found: '+req.body.refresh_token);
					throw "invalid_grant";
				}

				if (refresh_token.client_id != clientId) {
					console.log("refresh token client id mismatch");;
					throw "invalid_grant";
				} 

				var access_token = randomstring.generate();
				const expires_in = 60*60*24; //24 hours

				const token_response = {
					access_token: access_token, 
					token_type: 'Bearer',  
					refresh_token: refresh_token.refresh_token
				}

				const token_insert = { 
					access_token: access_token, 
					expires_at: new Date().getTime()+1000*expires_in,
					client_id: clientId, 
					scope: refresh_token.scope, 
					username: refresh_token.username, 
					sub: refresh_token.sub 
				};

				await db.tokens.insert(token_insert);

				console.log('\n\nRefresh_token\nIssuing access token: %s\n%s\n\n', clientId, JSON.stringify(token_response));
				res.status(200).json(token_response);
			} 
			else {
				console.log('Unknown grant type %s', req.body.grant_type);
				throw "invalid_grant";
			}
    	} catch (e) {
			console.log(e);
			res.status(401).json({error: e});
			return;
        }    
    })();
});

// Remote login from a credential server (eg. IdOra). Note that this function needs to respond to two requests:
// 1. Pending login (long poll)
// 2. This POST from the credential server

router.post('/authsession', auth.getAccessToken, function (req, res) {

    (async () => {
        try {
        	function abort(code, message) {
        		throw {status: code, message: message};
        	}

        	// Session ID
        	if (req.body.sessionId == undefined) {
				abort(400, "Bad Request - SessionId");
			}

			// Pending Login
        	let pendingLogin = db.pendingLogins[req.body.sessionId];
        	if (pendingLogin == undefined) {
        		abort(404, "Not Found - Pending Login");
        	}

        	// Ensure /idoraxhr POST has been received prior to this
  			if (pendingLogin.req == undefined) {
  				abort(404, "Not Found - Long poll not established" );
  			}

        	// Ensure /idoraxhr POST has been received
  			if (pendingLogin.req.session == undefined) {
  				abort(404, "Not found - Session" );
  			}

        	pendingLogin.req.session.authenticated = true;
			pendingLogin.req.session.user = req.body.username;
        	const query = pendingLogin.parms;

        	// Client
        	if (query.client_id == undefined) {
				abort(400, "Bad Request - client_id");
			}

        	let client = await db.getClient(query.client_id);
			if (!client) {
				abort( 403, "Forbidden - Unknown Client");
			}

			// Access Token
			if (req.access_token == undefined) {
				abort( 401, "Access token required");
			}

			if (pendingLogin.generateResponse) {
				// User endpoint requires a specific response - eg. /register_device
				pendingLogin.generateResponse(req.body.sessionId, req.access_token);
			}
			else {
				// User is requesting an access token - return a redirectURI with a code to be exchanged
				var cscope = client.scope ? client.scope.split(' ') : undefined;

				var code = randomstring.generate(8);
				var user = {username: req.access_token.username, sub: req.access_token.sub};

				// save the code and request for later	
				db.codes[code] = { request: query, scope: cscope, user: user };
		
				var urlParsed = auth.buildUrl(query.redirect_uri, {
					code: code,
					state: query.state
				});

				pendingLogin.res.send(urlParsed).end();
				delete db.pendingLogins[req.body.sessionId];
			}
			res.status(204).end();
        }
        catch (e) {
        	if (typeof e === 'string') {
        		res.status(400);
        		res.send(e);
        	}
        	else if (typeof e === 'object' && e.status != undefined && e.message != undefined) {
				res.status(e.status);
				res.send(e.message);
        	}
        	else {
				res.status(400);
				res.send("unknown authorization error");
        	}
        	console.log("authsession error: "+ JSON.stringify(e));
        } 
	})();
});

router.post('/revoke', function(req, res) {


	let clientId, clientSecret;

	(async () => {
        try {
        	// Authorization
			if (req.headers.authorization) {
				const clientCredentials = auth.decodeClientCredentials(req.headers.authorization);
				clientId = clientCredentials.id;
				clientSecret = clientCredentials.secret;
			}
			else if (req.body.client_id) {
				clientId = req.body.client_id;
				clientSecret = req.body.client_secret;
			}

			// Client
			let client = await db.getClient(clientId);
			if (!client) {
				throw "invalid client";
			}
			else if (client.client_secret != clientSecret) {
				throw "invalid_client_secret";
			}

			const access_token = { 
				access_token: req.body.access_token ? req.body.access_token : "", 
				client_id: clientId 			
			};

			const refresh_token = { 
				refresh_token: req.body.refresh_token ? req.body.refresh_token : "", 
				client_id: clientId			
			};

			await db.tokens.remove(access_token);
			await db.tokens.remove(refresh_token);
			res.status(204).end();

    	} catch (e) {
			console.log(e);
			res.status(401).json({error: e});
			return;
        } 
    })();
});

module.exports = router;
