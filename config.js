const os = require('os');
const __ = require('underscore');
const ipAddr = __.find(os.networkInterfaces().en0, addr => {return(addr.family == 'IPv4')}).address

const clientInfo = [
	{	"client_id": "idora",
		"client_secret": "idora-secret",
		"ipAddr" : {"host": ipAddr, "port": 9003},
		"redirect_uris": ['http://'+ipAddr+':9003/callback'],
		"scope": "authenticate_user",
		"refreshToken": true,
		"onetimeToken": false},

	{	"client_id": "deviceregistration",
		"client_secret": "deviceregistration-secret",
		"ipAddr" : {"host": ipAddr, "port": 9004},
		"redirect_uris": ['http://'+ipAddr+':9004/callback'],
		"scope": "install_device_credentials",
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
	}
};

const serverInfo = {
	micronets : {
		auth: {
			ipAddr: {host : ipAddr, port: 9001},
			authorizationEndpoint: 'http://'+ipAddr+':9001/loginapprove',
			tokenEndpoint: 'http://'+ipAddr+':9001/token',
			introspectionEndpoint: 'http://'+ipAddr+':9001/introspect',
			revocationEndpoint: 'http://'+ipAddr+':9001/revoke',
			registrationEndpoint: 'http://'+ipAddr+':9001/register',
			userInfoEndpoint: 'http://'+ipAddr+':9001/userinfo',
			remoteLogin: 'http://'+ipAddr+':9001/authsession',
			clients : ["idora", "deviceregistration"]
		},
		resource: {
			ipAddr: {host: ipAddr, port: 9002},
			resourceEndpoint: 'http://'+ipAddr+':9002/resource'
		}
	},
	glucoseApp : {
		auth: {
			ipAddr: {host : ipAddr, port: 9005},
			authorizationEndpoint: 'http://'+ipAddr+':9005/loginapprove',
			tokenEndpoint: 'http://'+ipAddr+':9005/token',
			introspectionEndpoint: 'http://'+ipAddr+':9005/introspect',
			revocationEndpoint: 'http://'+ipAddr+':9005/revoke',
			registrationEndpoint: 'http://'+ipAddr+':9005/register',
			userInfoEndpoint: 'http://'+ipAddr+':9005/userinfo',
			remoteLogin: 'http://'+ipAddr+':9005/authsession',
			clients : ["idora", "deviceregistration"]
		},
		resource: {
			ipAddr: {host: ipAddr, port: 9006},
			resourceEndpoint: 'http://'+ipAddr+':9006/resource'
		}
	}
};

module.exports = {
	servers: serverInfo,
	users: userInfo,
	clients: clientInfo
};

