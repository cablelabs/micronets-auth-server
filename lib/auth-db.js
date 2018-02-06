'use strict'


let __ = require('underscore');
__.string = require('underscore.string');

// Static configuration
const clients = require('./config.js').clients;

// Bob's nedb stuff
const Datastore = require('nedb-promises');
let db = {};
db.users = new Datastore({filename: 'micronets-users.nedb', autoload: true});
db.users.ensureIndex({fieldName: 'name', unique: true});
db.tokens = new Datastore({filename: 'micronets-tokens.nedb', autoload: true});

// Memory resident
var codes = {};
var requests = {};
let pendingLogins = {};

// Async in case it gets moved to a non-synchronous data store in the future
function getClient(clientId) {
	return new Promise((resolve, reject) => {
		const client = __.find(clients, function(client) { return client.client_id == clientId; });
		if(client) {
			resolve(client);
		} else {
			reject('Unknown client: '+ clientId);
		}
	});
}

module.exports = {
	// Promises
	getClient: getClient,

	// Memory resident structures
	pendingLogins: pendingLogins,
	codes: codes,
	requests: requests,

	// Nedb 
	users: db.users,
	tokens: db.tokens
}