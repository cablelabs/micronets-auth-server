/* Default routes for non-oauth client endpoints
 */

var express = require('express');
var router = express.Router();
var randomstring = require("randomstring");

// Local modules
const db = require('../lib/auth-db.js');
const config = require('../lib/config.js');
const obj = require ('../lib/objUtils.js');

// Promisified methods
const promisify = require('es6-promisify').promisify;
const http_post = promisify(require('../lib/http_request.js').http_post);
const http_get = promisify(require('../lib/http_request.js').http_get);

// Home
router.get('/', function(req, res) {
	//res.render('index', {clients: db.clients, authServer: authServer});
	res.send("<h1>TODO: /index - route not implemented</h1>");
});

// Long poll from user web browser (waiting for remote login)
router.post('/idoraxhr', function (req, res) {
	db.pendingLogins[req.body.sessionId]['req'] = req;
	db.pendingLogins[req.body.sessionId]['res'] = res;
});

// Here via redirect from the clinic browser. A device has been selected, awaiting authorization
// from the subscriber to pair the device. This is basically a MSO login page with a QRCode instead of 
// the usual user/pass fields, and it also displays the medical device information and asks if 
// the user wants to register the device to their account.

router.get('/register-device', function(req, res) {

	// Temp %%% Fix arg mismatch. Bob's code expects _id later in /auth_session
	req.query.client_id = req.query.clientID;

    (async () => {

        try {
        	let client = await db.getClient(req.query.clientID);

        	// Request a registration token from the mso-portal. Create new post body - pass only what is required.
			const props = ["clientID", "deviceID", "vendor", "type", "model", "serial", "macAddress"];
			const postHeaders = {"content-type": "application/json"};
			const postBody = JSON.stringify(obj.extract(req.body, props));
			const uri = config.msoPortalURI+"/portal/registration-token";

			const response = await http_post(uri, postHeaders, postBody);

			var reqid = randomstring.generate(8);
			db.requests[reqid] = req.query;

			const sessionId = randomstring.generate(8);

			db.pendingLogins[sessionId] = {
				parms: req.query,
				registrationToken: response.registration.token,
				// Each endpoint that can be remotely logged in (eg. /register_device via IdOra) will likely require a specific
				// response, eg. a redirect URL or a JSON structure. This callback is invoked by authsession().
				generateResponse: function(sessionId, accessToken) {
					(async () => {
						let returnObj = {};
						try {
							pendingLogin = db.pendingLogins[sessionId];
							const uri = config.msoPortalURI+"/internal/subscriber/"+accessToken.sub;

							let response = await http_get(uri);

							if (response.error != null) {
					            returnObj.error = response.error;
					            returnObj.status = 400;
					            pendingLogin.res.status(returnObj.status);
					        }
					        else {
								returnObj.subscriberID = response.id;
								returnObj.ssid = response.ssid;
								returnObj.registrationToken = pendingLogin.registrationToken;
								returnObj.redirectURI = req.query.redirect_uri;
					        }
						} 
						catch (e) {
				            returnObj.error = e;
					        returnObj.status = 400;
					        pendingLogin.res.status(returnObj.status);
				        }
				        finally {
							delete db.pendingLogins[req.body.sessionId];
					        pendingLogin.res.send(JSON.stringify(returnObj)).end();
				        } 
				    })();
				}
			};

			// Generate a QRCode and render the device registration page
			var QRCode = require('qrcode');
			var qrcData = {sessionId: sessionId, domain: "micronets"};

			QRCode.toDataURL(JSON.stringify(qrcData), function (err, url) {

				var templateVars = {
					provider: client.client_name, 
					vendor: req.query.vendor, 
					model: req.query.model, 
					serial: req.query.serial, 
					type: req.query.type,
					qrcode: url,
					sessionId: sessionId,
					path: '/idoraxhr'
				}

				res.render('device-registration', templateVars);
			});
        } catch (e) {
            res.status = 400;
            res.send("<h1>TODO: Implement error view</h1><h3> Error: "+e+"</h3>");
        } 
    })();
});

// Testing
router.post('/userpass', function(req, res) {
	const u = req.body.username;
	const p = req.body.password;
	if ( u && p && db.users[u] && p === db.users[u].password) {
		res.status(200).send();
	} else {
		res.status(403).send();
	}
	res.end();
	return
});

module.exports = router;
