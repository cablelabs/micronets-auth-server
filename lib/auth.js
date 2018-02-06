'use strict'

/* auth.js - utility functions for authorization */

const db = require('../lib/auth-db.js');
const config = require('../lib/config.js');
const URL = require('url');

let __ = require('underscore');
__.string = require('underscore.string');

/* example access token
{
  "access_token": "cFGxa1tYnSbXPqkvyqBExmCDAJuedtto",
  "expires_at": 2508450996080,
  "client_id": "idora",
  "scope": [
    "authenticate_user"
  ],
  "username": "grandma",
  "sub": "7B2A-BE88-08817Z",
  "_id": "MJF0I1DRaTCBAUR6"
}
*/

// Access token is passed from IdOra when doing a remote login (QRCode)
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

	(async () => {
        try {
        	let token = await db.tokens.findOne({access_token: inToken});
			if (!token) {
				//console.log("token not found: "+inToken);
				res.status(401).end();
			}
			else if(token.expires_at < new Date().getTime()) {
				res.status(401).end();
				let num = await db.tokens.remove({access_token: token.access_token, client_id: token.client_id}, {});
				//console.log('/getAccessToken(): %d access tokens removed', num);
			}
			else {
				req.access_token = token;
				//console.log('getAccessToken: %s', JSON.stringify(token));
				next();
			}
        } catch (e) {
        	console.log('/getAccessToken(): error: %s', e);
			res.status(500).end();
        }
    })();
}

// Check username/password (If not using QRCode)
function authenticateUser(username, password) {
	const userInfo = config.users;
	return new Promise((resolve, reject) => {
		if(userInfo[username] && password === userInfo[username].password) {
			resolve(userInfo[username].sub);
		} else {
			reject('unknown username or password');
		}
	});
}

// Get credentials from HTTP authorization header
function decodeClientCredentials(authHeader) {
	var clientCredentials = new Buffer(authHeader.slice('basic '.length), 'base64').toString().split(':');
	var clientId = querystring.unescape(clientCredentials[0]);
	var clientSecret = querystring.unescape(clientCredentials[1]);	
	return { id: clientId, secret: clientSecret };
};

// Create the redirect URL to return to user.
function buildUrl(base, options, hash) {
	var newUrl = URL.parse(base, true);
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
	
	return URL.format(newUrl);
};

module.exports = {
	getAccessToken: getAccessToken,
	authenticateUser: authenticateUser,
	decodeClientCredentials: decodeClientCredentials,
	buildUrl: buildUrl
}