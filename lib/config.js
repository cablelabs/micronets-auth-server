const os = require('os');
const __ = require('underscore');
const ipAddr = __.find(os.networkInterfaces().en0, addr => {return(addr.family == 'IPv4')}).address;

const msoPortalURI = "http://localhost:3010";

const clientInfo = [
	{	"client_id": "idora",
		"client_secret": "idora-secret",
		"client_name": "Identity Oracle (IdOra)",
		"ipAddr" : {"host": ipAddr, "port": 9003},
		"redirect_uris": ['http://'+ipAddr+':9003/callback'],
		"scope": "authenticate_user",
		"refreshToken": true,		"onetimeToken": false},

	{	"client_id": "deviceregistration",
		"client_secret": "deviceregistration-secret",
		"client_name": "Device Registration",
		"ipAddr" : {"host": ipAddr, "port": 9004},
		"redirect_uris": ['http://'+ipAddr+':9004/callback'],
		"scope": "install_device_credentials",
		"refreshToken": false,
		"onetimeToken": true},

	// Steve: added client for our demo clinic
	{	"client_id": "clinic-858",
		"client_secret": "clinic-858-secret",
		"client_name": "Alpine Senior Care",
		"ipAddr" : {"host": ipAddr, "port": 9004},
		"redirect_uris": ['http://'+ipAddr+':9004/callback'],
		"scope": "wifi-certificate",
		"refreshToken": false,
		"onetimeToken": true}

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
	ipAddr: ipAddr,
	port: 3020,	// internal
	baseURI: "https://mycable.co/micronets/",
	endpoints: {
		authorize: "oauth2/authorize",
		token: "oauth2/token",
		introspection: "oauth2/introspect",
		revocation: "oauth2/revoke",
		remoteLogin: "oauth2/authsession",
		deviceRegistration: "deviceRegistration"
	}
};

var self = module.exports = {
	users: userInfo,
	clients: clientInfo,
	msoPortalURI: msoPortalURI,
	server: server
};

// ENV overrides
if (process.env.mso_portal_url) {
	self.msoPortalUrl = process.env.mso_portal_url;
}

