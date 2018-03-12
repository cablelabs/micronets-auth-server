let regServerUrl = "http://localhost:3000";
let msoPortalUrl = "http://localhost:3010";
let authServerUrl = "http://localhost:3020";
let idoraServerUrl = "http://localhost:9003";

// ENV overrides
if (process.env.mso_portal_url) {
	msoPortalUrl = process.env.mso_portal_url;
}
if (process.env.idora_server_url) {
	idoraServerUrl = process.env.idora_server_url;
}
if (process.env.reg_server_url) {
	regServerUrl = process.env.reg_server_url;
}

const clientInfo = [
	{	
		"client_id": "idora",
		"client_secret": "idora-secret",
		"client_name": "Identity Oracle (IdOra)",
		"redirect_uris": [idoraServerUrl+'/callback'],
		"scope": "authenticate_user",
		"refreshToken": true,		
		"onetimeToken": false
	},
	{	// Not using this for access tokens - a registration token is provided by the MSO Portal. Here for completeness
		"client_id": "clinic-858",
		"client_secret": "clinic-858-secret",
		"client_name": "Alpine Senior Care",
		"redirect_uris": [regServerUrl+'/callback'],
		"scope": "wifi-certificate",
		"refreshToken": false,
		"onetimeToken": true
	}
];

const userInfo = {
	"alice": {
		"sub": "9XE3-JI34-00132A",
		"username": "alice",
		"password": "secret"
	},
	
	"bob": {
		"sub": "1ZT5-OE63-57383B",
		"username": "bob",
		"password": "pass"
	},
	
	"grandma": {
		"sub": "7B2A-BE88-08817Z",
		"username": "grandma",
		"password": "pass"
	}
};

const server = {
	//ipAddr: ipAddr,
	port: process.env.PORT || 3020,	// internal
	endpoints: {
		authorize: authServerUrl+"/oauth2/authorize",
		token: authServerUrl+"/oauth2/token",
		introspection: authServerUrl+"/oauth2/introspect",
		revocation: authServerUrl+"/oauth2/revoke",
		remoteLogin: authServerUrl+"/oauth2/authsession",
		deviceRegistration: authServerUrl+"/deviceRegistration"
	}
};

var self = module.exports = {
	users: userInfo,
	clients: clientInfo,
	msoPortalUrl: msoPortalUrl,
	server: server
};

